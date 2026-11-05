// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { RegistrationItemRows, emptyRegistrationItems } from "../RegistrationItemRows";

describe("RegistrationItemRows", () => {
  it("行を足す・消す・書き換える", () => {
    const onChange = vi.fn();
    const rows = emptyRegistrationItems();
    render(<RegistrationItemRows rows={rows} onChange={onChange} />);
    expect(screen.getByText("1点目")).toBeTruthy();
    expect(screen.getByText("2点目")).toBeTruthy();
    fireEvent.change(screen.getAllByLabelText("名前")[1], { target: { value: "SD" } });
    expect(onChange).toHaveBeenLastCalledWith([rows[0], { ...rows[1], title: "SD" }]);
    fireEvent.click(screen.getByRole("button", { name: "品目を足す" }));
    expect(onChange.mock.lastCall?.[0]).toHaveLength(3);
    fireEvent.click(screen.getByRole("button", { name: "1点目を消す" }));
    expect(onChange.mock.lastCall?.[0]).toEqual([rows[1]]);
  });
});
