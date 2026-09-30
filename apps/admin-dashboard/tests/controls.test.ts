import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vite-plus/test";
import { Dropdown, FilterBar, FilterToggle, nextIndex, toggleValue } from "../src/app/ui/controls";

/**
 * The controls, in the states a panel puts them in.
 *
 * Rendered to static markup on purpose. What these tests are for is the states:
 * a filter that is pressed and one that is not, a dropdown that has chosen
 * something. Those are all strings, and asserting on strings is a test that
 * cannot pass by accident when a class name changes.
 *
 * Everything here is markup, so nothing in this file mounts a tree or handles a
 * key. It used to: the search field's Escape and the dropdown's arrow keys are
 * behaviour rather than a state, and were driven with real keyboard events. The
 * search field is gone, and the dropdown's key handling is a view's business —
 * it is the one control whose only interactive half is inside itself.
 */

const OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "critical", label: "Critical" },
  { value: "degraded", label: "Degraded" },
  { value: "resolved", label: "Resolved", disabled: true },
];

describe("toggleValue", () => {
  test("it adds a value that is not there", () => {
    expect(toggleValue(["a"], "b")).toEqual(["a", "b"]);
  });

  test("it takes one out that is", () => {
    expect(toggleValue(["a", "b"], "a")).toEqual(["b"]);
  });

  test("it leaves the original alone", () => {
    const values = ["a"];
    toggleValue(values, "b");
    expect(values).toEqual(["a"]);
  });

  test("toggling twice is the identity", () => {
    const values = ["a", "b"];
    expect(toggleValue(toggleValue(values, "c"), "c")).toEqual(values);
  });
});

describe("nextIndex", () => {
  test("down goes to the first option from nothing", () => {
    expect(nextIndex(-1, 3, "ArrowDown")).toBe(0);
  });

  test("up from nothing lands on the last option", () => {
    // Opening a listbox with Up is the gesture for "the last one", the way it is
    // in a file manager and the way it is in a select.
    expect(nextIndex(-1, 3, "ArrowUp")).toBe(2);
  });

  test("down past the end wraps to the start", () => {
    expect(nextIndex(2, 3, "ArrowDown")).toBe(0);
  });

  test("up past the start wraps to the end", () => {
    expect(nextIndex(0, 3, "ArrowUp")).toBe(2);
  });

  test("down moves one", () => {
    expect(nextIndex(0, 3, "ArrowDown")).toBe(1);
  });

  test("Home and End go to the ends", () => {
    expect(nextIndex(1, 3, "Home")).toBe(0);
    expect(nextIndex(1, 3, "End")).toBe(2);
  });

  test("a key that is not navigation leaves the highlight alone", () => {
    expect(nextIndex(1, 3, "Tab")).toBe(1);
    expect(nextIndex(1, 3, "a")).toBe(1);
  });

  test("an empty list has nowhere to go", () => {
    expect(nextIndex(-1, 0, "ArrowDown")).toBe(-1);
    expect(nextIndex(-1, 0, "Home")).toBe(-1);
  });
});

describe("FilterToggle", () => {
  const render = (props: Parameters<typeof FilterToggle>[0]): string =>
    renderToStaticMarkup(createElement(FilterToggle, props));

  test("an unpressed filter says so", () => {
    const html = render({ label: "Critical", pressed: false, onToggle: () => {} });
    expect(html).toContain('aria-pressed="false"');
  });

  test("a pressed filter says so", () => {
    const html = render({ label: "Critical", pressed: true, onToggle: () => {} });
    expect(html).toContain('aria-pressed="true"');
    expect(html).toContain("text-accent");
  });

  test("a count is shown after the label", () => {
    expect(render({ label: "Critical", pressed: true, onToggle: () => {}, count: 4 })).toContain(
      "4",
    );
  });

  test("a disabled filter is disabled", () => {
    const html = render({
      label: "Critical",
      pressed: false,
      onToggle: () => {},
      disabled: true,
    });
    expect(html).toContain("disabled");
  });
});

describe("FilterBar", () => {
  test("it is a labelled group, so its buttons are not anonymous", () => {
    const html = renderToStaticMarkup(
      createElement(FilterBar, {
        label: "Filter by status",
        children: createElement(FilterToggle, {
          label: "Critical",
          pressed: false,
          onToggle: () => {},
        }),
      }),
    );
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Filter by status"');
  });
});

describe("Dropdown", () => {
  const render = (props: Partial<Parameters<typeof Dropdown>[0]> = {}): string =>
    renderToStaticMarkup(
      createElement(Dropdown, {
        value: null,
        options: OPTIONS,
        onSelect: () => {},
        label: "Status",
        ...props,
      }),
    );

  test("it starts closed, and says it is", () => {
    const html = render();
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('aria-haspopup="listbox"');
  });

  test("with nothing chosen the trigger shows the placeholder", () => {
    expect(render()).toContain("Select");
  });

  test("with something chosen the trigger shows that option, not the placeholder", () => {
    // A dropdown whose trigger keeps saying "Select" once a choice is made is a
    // filter whose state cannot be read off the screen.
    const html = render({ value: "critical" });
    expect(html).toContain("Critical");
    expect(html).not.toContain(">Select<");
  });

  test("a closed dropdown renders no options at all", () => {
    expect(render()).not.toContain('role="listbox"');
    expect(render()).not.toContain("Degraded");
  });

  test("it is labelled", () => {
    expect(render()).toContain('aria-label="Status"');
  });

  test("a disabled dropdown's trigger is disabled", () => {
    expect(render({ disabled: true })).toContain("disabled");
  });
});
