#!/usr/bin/env python3
"""Decode locally captured chapter HTML into ordered question records.

Only the Python standard library is used. Question text is written to JSON files;
stdout contains IDs, counts, and issue codes only.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Any


BLOCK_TAGS = {"address", "article", "blockquote", "dd", "div", "dl", "dt", "figcaption", "figure", "h1", "h2", "h3", "h4", "h5", "h6", "li", "ol", "p", "pre", "section", "table", "td", "th", "tr", "ul"}
VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
NUMBER_RE = re.compile(r"^\s*(?:(?:第\s*)?(\d{1,4})\s*[.、:：)）]|[（(]\s*(\d{1,4})\s*[）)])\s*(.*)$", re.S)
SOLUTION_MARKER_RE = re.compile(r"(?:solution|answer|explanation|解析|解答)", re.I)


@dataclass
class Node:
    tag: str
    attrs: dict[str, str | None] = field(default_factory=dict)
    children: list["Node | str"] = field(default_factory=list)
    parent: "Node | None" = field(default=None, repr=False)

    def attr(self, name: str) -> str:
        value = self.attrs.get(name)
        return value if isinstance(value, str) else ""


class CaptureParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.root = Node("#root")
        self.stack = [self.root]

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag.lower(), dict(attrs))
        node.parent = self.stack[-1]
        self.stack[-1].children.append(node)
        if tag.lower() not in VOID_TAGS:
            self.stack.append(node)

    def handle_startendtag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        node = Node(tag.lower(), dict(attrs))
        node.parent = self.stack[-1]
        self.stack[-1].children.append(node)

    def handle_endtag(self, tag: str) -> None:
        tag = tag.lower()
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                del self.stack[index:]
                return

    def handle_data(self, data: str) -> None:
        self.stack[-1].children.append(data)


def walk(node: Node):
    for child in node.children:
        if isinstance(child, Node):
            yield child
            yield from walk(child)


def direct_nodes(node: Node):
    return (child for child in node.children if isinstance(child, Node))


def text_content(node: Node, *, trim: bool = True) -> str:
    pieces: list[str] = []

    def visit(current: Node) -> None:
        for child in current.children:
            if isinstance(child, str):
                pieces.append(child)
            elif child.tag == "br":
                pieces.append("\n")
            elif child.tag in {"svg", "script", "style", "button", "textarea"}:
                continue
            else:
                visit(child)
                if child.tag in BLOCK_TAGS:
                    pieces.append("\n")

    visit(node)
    lines = [re.sub(r"[\t\r\f\v ]+", " ", line).strip() for line in "".join(pieces).split("\n")]
    value = "\n".join(line for line in lines if line)
    return value.strip() if trim else value


def component(node: Node) -> str:
    return node.attr("data-d-component").strip().lower()


def role(node: Node) -> str:
    return node.attr("role").strip().lower()


def is_question_number(text: str) -> tuple[int, str] | None:
    match = NUMBER_RE.match(text)
    if not match:
        return None
    number = int(match.group(1) or match.group(2))
    body = match.group(3).strip()
    return number, body


def numbered_blocks(root: Node, numbered_hint: Any, captured_count: Any) -> tuple[list[tuple[Node, int, str]], int]:
    candidates: list[tuple[Node, int, str]] = []
    for node in walk(root):
        if node.tag not in {"p", "li", "h1", "h2", "h3", "h4", "h5", "h6"} and component(node) != "text":
            continue
        text = text_content(node)
        parsed = is_question_number(text)
        if parsed:
            candidates.append((node, parsed[0], parsed[1]))

    # Drop a numbered parent if a more specific numbered text block is nested in it.
    selected: list[tuple[Node, int, str]] = []
    candidate_ids = {id(item[0]) for item in candidates}
    for item in candidates:
        node = item[0]
        if any(id(descendant) in candidate_ids for descendant in walk(node)):
            continue
        selected.append(item)
    original_count = len(selected)
    expected_numbers: list[int] = []
    if isinstance(numbered_hint, list):
        for value in numbered_hint:
            try:
                expected_numbers.append(int(value))
            except (TypeError, ValueError):
                continue
    if expected_numbers:
        ordered: list[tuple[Node, int, str]] = []
        cursor = 0
        for expected in expected_numbers:
            while cursor < len(selected):
                item = selected[cursor]
                cursor += 1
                if item[1] == expected:
                    ordered.append(item)
                    break
        selected = ordered
    elif isinstance(captured_count, int) and not isinstance(captured_count, bool) and captured_count >= 0:
        selected = selected[:captured_count]
    return selected, max(0, original_count - len(selected))


def option_groups(root: Node) -> list[dict[str, Any]]:
    groups: list[dict[str, Any]] = []
    seen_option_ids: set[int] = set()
    order_lookup = {id(node): index for index, node in enumerate(walk(root))}
    group_nodes = [node for node in walk(root) if component(node) == "radio-group" or role(node) == "radiogroup"]
    for group in group_nodes:
        options: list[dict[str, str]] = []
        for node in walk(group):
            option_role = role(node)
            option_component = component(node)
            if option_role not in {"radio", "checkbox"} and option_component not in {"radio", "checkbox"}:
                continue
            if id(node) in seen_option_ids:
                continue
            seen_option_ids.add(id(node))
            kind = "checkbox" if option_role == "checkbox" or option_component == "checkbox" else "radio"
            label = text_content(node)
            if label:
                options.append({"kind": kind, "text": label})
        if options:
            kinds = {option["kind"] for option in options}
            groups.append({"kind": "mixed" if len(kinds) > 1 else next(iter(kinds)), "options": options, "_order": order_lookup[id(group)]})

    # Group standalone controls by their nearest bordered question card.
    checkbox_buckets: dict[int, tuple[Node, list[dict[str, str]]]] = {}
    for node in walk(root):
        if (role(node) == "checkbox" or component(node) == "checkbox") and id(node) not in seen_option_ids:
            seen_option_ids.add(id(node))
            label = text_content(node)
            if label:
                owner = node.parent or root
                while owner.parent is not None and owner.attr("data-d-has-border") is None:
                    owner = owner.parent
                bucket = checkbox_buckets.setdefault(id(owner), (owner, []))[1]
                bucket.append({"kind": "checkbox", "text": label})
    for owner, options in checkbox_buckets.values():
        groups.append({"kind": "checkbox", "options": options, "_order": order_lookup.get(id(owner), 0)})
    groups.sort(key=lambda group: group.get("_order", 0))
    for group in groups:
        group.pop("_order", None)
    return groups


def solutions(root: Node) -> list[str]:
    marked: list[Node] = []
    for node in walk(root):
        marker = " ".join((node.attr(key) for key in ("data-d-component", "data-testid", "aria-label", "data-role")))
        if SOLUTION_MARKER_RE.search(marker):
            marked.append(node)
    marked_ids = {id(node) for node in marked}
    outermost = [node for node in marked if not any(id(desc) in marked_ids for desc in walk(node))]
    values = [text_content(node) for node in outermost]
    return [value for value in values if value]


def decode_section(section: dict[str, Any], section_index: int) -> tuple[dict[str, Any] | None, list[str]]:
    issues: list[str] = []
    html = section.get("html")
    if not isinstance(html, str) or not html.strip():
        return None, ["missing_html"]
    parser = CaptureParser()
    try:
        parser.feed(html)
        parser.close()
    except Exception:
        return None, ["invalid_html"]
    root = parser.root
    numbered, ignored_numbered = numbered_blocks(root, section.get("numbered"), section.get("count"))
    groups = option_groups(root)
    visible_solutions = solutions(root)
    if not numbered and not groups:
        return None, ["no_numbered_questions_or_option_groups"]

    total = max(len(numbered), len(groups))
    questions: list[dict[str, Any]] = []
    for index in range(total):
        prompt_node = numbered[index][0] if index < len(numbered) else None
        number = numbered[index][1] if index < len(numbered) else None
        prompt = numbered[index][2] if index < len(numbered) else ""
        group = groups[index] if index < len(groups) else {"kind": "none", "options": []}
        solution = visible_solutions[index] if index < len(visible_solutions) else None
        question_issues: list[str] = []
        if number is None:
            question_issues.append("missing_explicit_question_number")
        if not prompt:
            question_issues.append("missing_prompt_text")
        if not group["options"]:
            question_issues.append("no_grouped_options")
        if solution is None:
            question_issues.append("no_visible_solution_marker")
        questions.append({
            "number": number,
            "prompt": prompt,
            "options": group["options"],
            "optionType": group["kind"],
            "solution": solution,
            "issues": question_issues,
        })

    if groups and len(numbered) != len(groups):
        issues.append("numbered_prompt_option_group_count_mismatch")
    if ignored_numbered:
        issues.append("extra_number_like_text_blocks_ignored")
    if not visible_solutions:
        issues.append("no_visible_solution_markers")
    if not section.get("messageId"):
        issues.append("missing_message_id")
    if not isinstance(section.get("heading"), str) or not section.get("heading", "").strip():
        issues.append("missing_heading")
    record = {
        "sectionIndex": section_index,
        "heading": section.get("heading") if isinstance(section.get("heading"), str) else "",
        "messageId": section.get("messageId") if isinstance(section.get("messageId"), str) else "",
        "questions": questions,
        "metadata": {
            "capturedQuestionCount": section.get("count") if isinstance(section.get("count"), int) else None,
            "extractedNumberedCount": len(numbered),
            "extractedOptionGroupCount": len(groups),
            "visibleSolutionCount": len(visible_solutions),
            "issues": issues,
        },
    }
    return record, issues


def atomic_write(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=path.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as stream:
            json.dump(payload, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except OSError:
            pass
        raise


def decode_file(path: Path) -> tuple[dict[str, Any] | None, list[dict[str, Any]]]:
    try:
        source = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None, [{"code": "invalid_capture_json", "sectionIndex": None}]
    if not isinstance(source, dict):
        return None, [{"code": "capture_root_not_object", "sectionIndex": None}]
    capture_id = source.get("id")
    if not isinstance(capture_id, str) or not capture_id:
        return None, [{"code": "missing_capture_id", "sectionIndex": None}]
    sections = source.get("sections")
    if not isinstance(sections, list):
        return None, [{"code": "missing_sections_array", "sectionIndex": None}]
    if not sections:
        return None, [{"code": "no_captured_sections_source_missing_or_empty", "sectionIndex": None}]

    output_sections: list[dict[str, Any]] = []
    issues: list[dict[str, Any]] = []
    for index, section in enumerate(sections):
        if not isinstance(section, dict):
            issues.append({"code": "section_not_object", "sectionIndex": index})
            continue
        record, section_issues = decode_section(section, index)
        if record is None:
            issues.extend({"code": code, "sectionIndex": index} for code in section_issues)
            continue
        output_sections.append(record)
        issues.extend({"code": code, "sectionIndex": index} for code in section_issues)
    if not output_sections:
        return None, issues or [{"code": "no_usable_sections", "sectionIndex": None}]
    return {"id": capture_id, "sections": output_sections, "metadata": {"issueCount": len(issues)}}, issues


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, default=Path(__file__).with_name("chapter-captures"), help="directory containing captured chapter JSON")
    parser.add_argument("--output", type=Path, default=Path(__file__).with_name("decoded-chapters"), help="directory for decoded JSON files")
    parser.add_argument("--id", dest="capture_id", help="decode one capture ID only")
    parser.add_argument("--dry-run", action="store_true", help="parse and report metadata without writing output files")
    args = parser.parse_args()
    if not args.input.is_dir():
        parser.error(f"input directory does not exist: {args.input}")
    capture_name = re.compile(r"[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}\.json$")
    files = sorted(path for path in args.input.glob("*.json") if capture_name.fullmatch(path.name))
    if args.capture_id:
        files = [path for path in files if path.stem == args.capture_id]
        if not files:
            print(json.dumps({"status": "skipped", "id": args.capture_id, "issues": [{"code": "capture_not_found"}]}, ensure_ascii=False))
            return 0

    issue_counts: Counter[str] = Counter()
    summaries: list[dict[str, Any]] = []
    for path in files:
        decoded, issues = decode_file(path)
        issue_counts.update(item["code"] for item in issues)
        capture_id = decoded["id"] if decoded else path.stem
        if decoded and not args.dry_run:
            atomic_write(args.output / f"{capture_id}.json", decoded)
        summaries.append({
            "id": capture_id,
            "status": "usable" if decoded else "skipped",
            "sections": len(decoded["sections"]) if decoded else 0,
            "questions": sum(len(section["questions"]) for section in decoded["sections"]) if decoded else 0,
            "issues": [item["code"] for item in issues],
        })
    print(json.dumps({"dryRun": args.dry_run, "capturesScanned": len(files), "usable": sum(row["status"] == "usable" for row in summaries), "skipped": sum(row["status"] == "skipped" for row in summaries), "issueCounts": dict(sorted(issue_counts.items())), "captures": summaries}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
