// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { fixtureDataset } from "@/test/fixtures";
import { SearchApp } from "./SearchApp";

beforeAll(() => {
  // jsdom has no layout engine: report a fixed viewport so rows get rendered.
  globalThis.ResizeObserver = class {
    constructor(private readonly callback: ResizeObserverCallback) {}
    observe(target: Element) {
      this.callback([{ target, contentRect: { height: 400 } } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  };
});

afterEach(cleanup);

const setup = () => {
  const user = userEvent.setup();
  render(<SearchApp dataset={fixtureDataset()} />);
  return { user };
};

const count = () => screen.getByText(/of 7 items/).textContent;
const rowNames = () =>
  within(screen.getByRole("list", { name: "Search results" }))
    .getAllByRole("listitem")
    .map((row) => row.querySelector("[title]")?.textContent);

describe("SearchApp", () => {
  it("shows every item and a disabled reset button initially", () => {
    setup();
    expect(count()).toBe("7 of 7 items");
    expect(rowNames()).toHaveLength(7);
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });

  it("updates results and the count on every keystroke", async () => {
    const { user } = setup();
    const input = screen.getByRole("searchbox");

    await user.type(input, "dig");
    expect(count()).toBe("3 of 7 items");

    await user.type(input, "ital t");
    expect(count()).toBe("1 of 7 items");
    expect(rowNames()).toEqual(["Digital Thermometer"]);
  });

  it("combines search with the category, price and status filters", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox"), "monitor");
    await user.selectOptions(screen.getByRole("combobox", { name: "Category" }), "Cardiology");
    await user.type(screen.getByRole("spinbutton", { name: "Minimum price" }), "1");
    expect(rowNames()).toEqual(["Portable Monitor"]);

    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "inactive");
    expect(count()).toBe("0 of 7 items");
    expect(screen.getByText(/No items match/)).toBeInTheDocument();
  });

  it("flags an inverted price range", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("spinbutton", { name: "Minimum price" }), "100");
    await user.type(screen.getByRole("spinbutton", { name: "Maximum price" }), "50");
    expect(screen.getByRole("alert")).toHaveTextContent("Minimum price is greater than maximum price.");
    expect(count()).toBe("0 of 7 items");
  });

  it("resets every control and the results", async () => {
    const { user } = setup();
    await user.type(screen.getByRole("searchbox"), "digital");
    await user.selectOptions(screen.getByRole("combobox", { name: "Status" }), "active");
    expect(count()).toBe("2 of 7 items");

    await user.click(screen.getByRole("button", { name: "Reset" }));
    expect(count()).toBe("7 of 7 items");
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Status" })).toHaveValue("all");
    expect(screen.getByRole("button", { name: "Reset" })).toBeDisabled();
  });
});
