// @vitest-environment happy-dom

import {
  Fragment,
  act,
  createElement,
  createRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, test } from "vite-plus/test";
import { Dropdown } from "../src/app/ui/controls";
import { Modal, Popover } from "../src/app/ui/overlays";

/**
 * What a floating control does with the keyboard and the pointer.
 *
 * Every one of these ran without a DOM before this file: the suite rendered to
 * static markup, which is enough for a chip and not enough for the questions
 * that matter here. Does Escape close it. Does a press outside close it. Does
 * the trigger count as outside — because it does not, and a dropdown that closes
 * when its own button is pressed reopens on the next click, which is a menu that
 * flickers instead of opening.
 *
 * `happy-dom` is scoped to this file by the docblock above. The rest of the suite
 * stays in node, where SSR is what it should be tested in.
 */

declare global {
  // `var` is the only thing a `declare global` can hold, and this is React's own
  // flag: it is what tells `act` it is running in a test rather than in a page.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mounted: (() => void)[] = [];

/** Renders into a container on `document.body` and flushes effects. */
const mount = (element: ReactElement): HTMLElement => {
  const container = document.createElement("div");
  document.body.append(container);
  const root: Root = createRoot(container);
  act(() => root.render(element));
  mounted.push(() => {
    act(() => root.unmount());
    container.remove();
  });
  return container;
};

/**
 * A `MouseEvent` used for a `pointerdown` listener.
 *
 * Deliberately not a `PointerEvent`. The listener reads the target and nothing
 * else, and a pointer event that differs from a mouse one only in a field nobody
 * here reads is a field that can be missing in the environment and pass anyway.
 */
const press = (element: EventTarget): void => {
  act(() => {
    element.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
  });
};

const click = (element: EventTarget): void => {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const key = (element: EventTarget, value: string, shiftKey = false): void => {
  act(() => {
    element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true, shiftKey }));
  });
};

/** A dialog, a dropdown or a popover, wherever it ended up. */
const dialog = (): HTMLElement => {
  const found = document.querySelector<HTMLElement>('[role="dialog"], [role="listbox"]');
  if (found === null) {
    throw new Error("nothing is open");
  }
  return found;
};

const query = <T extends Element>(root: ParentNode, selector: string): T => {
  const found = root.querySelector<T>(selector);
  if (found === null) {
    throw new Error(`nothing matched ${selector}`);
  }
  return found;
};

const OPTION_LABELS = ["All statuses", "Critical", "Degraded", "Resolved"];

afterEach(() => {
  for (const undo of mounted.splice(0).reverse()) {
    undo();
  }
  document.body.replaceChildren();
});

/**
 * Renders a controlled child, and hands the caller the state as well as the
 * setter.
 *
 * Both, because a render prop that is only given the setter leaves the child
 * reading `open` from wherever it can find it — and in a DOM environment it can
 * find it: `window.open` is a function, so a dialog meant to start closed
 * starts open, and the test asserts the opposite of what it says.
 */
function Controlled({
  children,
}: {
  children: (isOpen: boolean, setIsOpen: (open: boolean) => void) => ReactNode;
}): ReactElement {
  const [isOpen, setIsOpen] = useState(false);
  return createElement(Fragment, null, children(isOpen, setIsOpen));
}

describe("Modal", () => {
  /**
   * Focuses what a real click would focus, then clicks it.
   *
   * happy-dom does not move focus on a press, and a browser does. Without this
   * the opener never holds focus, and "hands the keyboard back" has nothing to
   * hand it back to — which fails for a reason that has nothing to do with the
   * code under test.
   */
  const open = (): void => {
    const target = query<HTMLButtonElement>(document.body, "[data-open]");
    act(() => target.focus());
    click(target);
  };

  const harness = (
    props: { initialFocus?: React.RefObject<HTMLButtonElement | null> } = {},
  ): {
    opener: HTMLButtonElement;
  } => {
    const opener = createRef<HTMLButtonElement>();
    mount(
      createElement(Controlled, {
        children: (isOpen, setIsOpen) =>
          createElement(
            Fragment,
            null,
            createElement(
              "button",
              { ref: opener, "data-open": "", onClick: () => setIsOpen(true) },
              "Delete",
            ),
            createElement(Modal, {
              open: isOpen,
              onClose: () => setIsOpen(false),
              title: "Delete flight KQ100",
              children: createElement("p", null, "This cannot be undone."),
              footer: createElement(
                "button",
                { type: "button", "data-cancel": "", ref: props.initialFocus },
                "Cancel",
              ),
              ...props,
            }),
          ),
      }),
    );
    return { opener: opener.current as HTMLButtonElement };
  };

  test("a closed modal is in the document only as the word closed", () => {
    mount(createElement(Modal, { open: false, onClose: () => {}, title: "Gone", children: null }));
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("it opens as a modal dialog, named by its title", () => {
    harness();
    open();
    const node = dialog();
    expect(node.getAttribute("aria-modal")).toBe("true");
    const labelledBy = node.getAttribute("aria-labelledby");
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy as string)?.textContent).toBe("Delete flight KQ100");
  });

  test("it renders into a portal, not into the panel it was opened from", () => {
    // Inside a panel that scrolls, a modal is clipped by the panel. This is the
    // assertion that fails the day someone takes the portal out for a simpler
    // return, which is the point of having it.
    const container = mount(
      createElement(Controlled, {
        children: (isOpen, setIsOpen) =>
          createElement(
            Fragment,
            null,
            createElement("button", { "data-open": "", onClick: () => setIsOpen(true) }, "Open"),
            createElement(Modal, {
              open: isOpen,
              onClose: () => setIsOpen(false),
              title: "Scoped",
              children: createElement("button", { type: "button" }, "Inside"),
            }),
          ),
      }),
    );
    open();
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    expect(container.querySelector("[role=dialog]")).toBeNull();
  });

  test("a dialog that is already open on mount still takes the keyboard", () => {
    // The regression that made this file necessary. The panel does not exist
    // until an effect has created the portal and committed into it, so anything
    // that reads its ref during the first commit is reading `null` and — its
    // dependencies being unchanged by the panel appearing — never runs again.
    // That left a modal that trapped no focus and restored none, with no symptom
    // beyond the keyboard wandering off behind it.
    mount(
      createElement(Modal, {
        open: true,
        onClose: () => {},
        title: "Open on mount",
        children: createElement("button", { type: "button" }, "Only"),
      }),
    );
    expect(dialog().contains(document.activeElement)).toBe(true);
  });

  test("Escape closes it", () => {
    harness();
    open();
    key(document, "Escape");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("a press on the backdrop closes it", () => {
    harness();
    open();
    press(query(document.body, "[data-modal-backdrop]"));
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("a press inside it does not", () => {
    harness();
    open();
    press(dialog());
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
  });

  test("the close button closes it", () => {
    harness();
    open();
    click(query<HTMLButtonElement>(dialog(), "[aria-label=Close]"));
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("it takes the keyboard on open", () => {
    harness();
    open();
    const inside = dialog().contains(document.activeElement);
    expect(inside).toBe(true);
  });

  test("it hands the keyboard back on close", () => {
    // The half that is usually missing. Without it the operator is dropped at the
    // top of the page, tabbing through the whole document to get back.
    const { opener } = harness();
    open();
    expect(document.activeElement).not.toBe(opener);
    key(document, "Escape");
    expect(document.activeElement).toBe(opener);
  });

  test("Tab from the last control wraps to the first", () => {
    harness();
    open();
    const last = query<HTMLButtonElement>(dialog(), "[data-cancel]");
    act(() => last.focus());
    key(last, "Tab");
    expect(document.activeElement).toBe(query<HTMLButtonElement>(dialog(), "[aria-label=Close]"));
  });

  test("Shift+Tab from the first control wraps to the last", () => {
    harness();
    open();
    const first = query<HTMLButtonElement>(dialog(), "[aria-label=Close]");
    act(() => first.focus());
    key(first, "Tab", true);
    expect(document.activeElement).toBe(query<HTMLButtonElement>(dialog(), "[data-cancel]"));
  });

  test("a dialog whose point is one control focuses that control", () => {
    // The trap focuses the first control, which for a destructive confirm is the
    // button that does the destructive thing.
    const cancel = createRef<HTMLButtonElement>();
    harness({ initialFocus: cancel });
    open();
    expect(document.activeElement).toBe(cancel.current);
  });
});

describe("Dropdown", () => {
  const OPTIONS = [
    { value: "all", label: "All statuses" },
    { value: "critical", label: "Critical" },
    { value: "degraded", label: "Degraded" },
    { value: "resolved", label: "Resolved", disabled: true },
  ];

  const setup = (
    props: Partial<Parameters<typeof Dropdown>[0]> = {},
  ): { picked: string[]; trigger: () => HTMLButtonElement } => {
    const picked: string[] = [];
    mount(
      createElement(Dropdown, {
        value: null,
        options: OPTIONS,
        onSelect: (value) => picked.push(value),
        label: "Status",
        ...props,
      }),
    );
    return { picked, trigger: () => query<HTMLButtonElement>(document.body, "button") };
  };

  test("a press on the trigger opens it", () => {
    setup();
    click(query<HTMLButtonElement>(document.body, "button"));
    expect(dialog().getAttribute("role")).toBe("listbox");
  });

  test("it opens in a portal, so a scrolling panel cannot clip it", () => {
    const container = mount(
      createElement(Dropdown, {
        value: null,
        options: OPTIONS,
        onSelect: () => {},
        label: "Status",
      }),
    );
    click(query<HTMLButtonElement>(container, "button"));
    expect(container.querySelector("[role=listbox]")).toBeNull();
    expect(document.querySelector("[role=listbox]")).not.toBeNull();
  });

  test("every option is offered, and the disabled one is marked", () => {
    setup();
    click(query<HTMLButtonElement>(document.body, "button"));
    const options = [...dialog().querySelectorAll<HTMLElement>('[role="option"]')];
    expect(options.map((option) => option.textContent)).toEqual(
      OPTION_LABELS.map((label) => expect.stringContaining(label)),
    );
    expect(options[3]?.getAttribute("aria-disabled")).toBe("true");
  });

  test("a second press on the trigger closes it", () => {
    setup();
    const trigger = query<HTMLButtonElement>(document.body, "button");
    click(trigger);
    click(trigger);
    expect(document.querySelector("[role=listbox]")).toBeNull();
  });

  test("a press on the trigger is not a press outside", () => {
    // The bug this guards is a menu that closes the instant it opens, because
    // the trigger was left out of the set of things that count as inside.
    setup();
    const trigger = query<HTMLButtonElement>(document.body, "button");
    click(trigger);
    press(trigger);
    expect(document.querySelector("[role=listbox]")).not.toBeNull();
  });

  test("a press outside closes it", () => {
    setup();
    click(query<HTMLButtonElement>(document.body, "button"));
    press(document.body);
    expect(document.querySelector("[role=listbox]")).toBeNull();
  });

  test("Escape closes it and leaves the keyboard on the trigger", () => {
    setup();
    const trigger = query<HTMLButtonElement>(document.body, "button");
    click(trigger);
    key(dialog(), "Escape");
    expect(document.querySelector("[role=listbox]")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  test("choosing an option selects it, closes, and returns the keyboard", () => {
    const { picked, trigger } = setup();
    click(trigger());
    click(query<HTMLElement>(dialog(), '[role="option"]:nth-child(2)'));
    expect(picked).toEqual(["critical"]);
    expect(document.querySelector("[role=listbox]")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  test("a disabled option cannot be chosen", () => {
    const { picked } = setup();
    click(query<HTMLButtonElement>(document.body, "button"));
    click(query<HTMLElement>(dialog(), '[role="option"]:nth-child(4)'));
    expect(picked).toEqual([]);
  });

  test("ArrowDown on the closed trigger opens it on the first option", () => {
    const { picked } = setup();
    const trigger = query<HTMLButtonElement>(document.body, "button");
    key(trigger, "ArrowDown");
    key(dialog(), "Enter");
    expect(picked).toEqual(["all"]);
  });

  test("ArrowUp on the closed trigger opens it on the last", () => {
    const { picked } = setup();
    key(query<HTMLButtonElement>(document.body, "button"), "ArrowUp");
    key(dialog(), "Enter");
    // The last option is disabled, so Enter declines rather than selecting a
    // choice the caller was told is not available.
    expect(picked).toEqual([]);
  });

  test("the arrows move the highlight, and Home and End reach the ends", () => {
    const { picked } = setup();
    const trigger = query<HTMLButtonElement>(document.body, "button");
    key(trigger, "ArrowDown");
    const menu = dialog();
    key(menu, "ArrowDown");
    key(menu, "ArrowDown");
    key(menu, "Enter");
    expect(picked).toEqual(["degraded"]);
  });

  test("the highlight is announced, so the open state is not just a colour", () => {
    setup();
    click(query<HTMLButtonElement>(document.body, "button"));
    const menu = dialog();
    key(menu, "ArrowDown");
    // A listbox with no highlight is a list of buttons to a screen reader, and
    // aria-activedescendant is what turns the highlight back into a position.
    const active = menu.querySelectorAll<HTMLElement>('[role="option"]')[0];
    expect(active?.getAttribute("aria-selected")).toBe("false");
  });

  test("the chosen option is marked selected", () => {
    setup({ value: "degraded" });
    click(query<HTMLButtonElement>(document.body, "button"));
    const selected = [...dialog().querySelectorAll<HTMLElement>('[role="option"]')].filter(
      (option) => option.getAttribute("aria-selected") === "true",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]?.textContent).toContain("Degraded");
  });
});

describe("Popover", () => {
  const setup = (): (() => HTMLButtonElement) => {
    const trigger = createRef<HTMLButtonElement>();
    mount(
      createElement(Controlled, {
        children: (isOpen, setIsOpen) =>
          createElement(
            Fragment,
            null,
            createElement("button", { ref: trigger, onClick: () => setIsOpen(true) }, "Columns"),
            createElement(Popover, {
              open: isOpen,
              onClose: () => setIsOpen(false),
              anchor: trigger,
              label: "Visible columns",
              children: createElement("p", null, "Callsign"),
            }),
          ),
      }),
    );
    return () => trigger.current as HTMLButtonElement;
  };

  test("it names itself, because a row of switches is not a name", () => {
    const trigger = setup();
    click(trigger());
    expect(dialog().getAttribute("aria-label")).toBe("Visible columns");
  });

  test("it is not a modal: the page behind it is still the page", () => {
    const trigger = setup();
    click(trigger());
    expect(dialog().getAttribute("aria-modal")).toBeNull();
  });

  test("a press on the trigger is not outside", () => {
    const trigger = setup();
    click(trigger());
    press(trigger());
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
  });

  test("Escape closes it", () => {
    const trigger = setup();
    click(trigger());
    key(document, "Escape");
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("a press outside closes it", () => {
    const trigger = setup();
    click(trigger());
    press(document.body);
    expect(document.querySelector("[role=dialog]")).toBeNull();
  });

  test("a press inside it does not", () => {
    const trigger = setup();
    click(trigger());
    press(dialog());
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
  });
});
