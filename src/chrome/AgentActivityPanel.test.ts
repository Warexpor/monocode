import { describe, expect, it } from "vitest";
import {
  isGoalTask,
  isVisibleActivityTask,
} from "./AgentActivityPanel";

describe("AgentActivityPanel goal chrome", () => {
  it("keeps completed goals visible so /goal progress does not vanish", () => {
    const goal = {
      id: "goal:g1",
      title: "Fix context meter",
      status: "completed" as const,
      detail: "3/3 deliverables",
    };
    expect(isGoalTask(goal)).toBe(true);
    expect(isVisibleActivityTask(goal)).toBe(true);
  });

  it("still hides ordinary completed background tasks", () => {
    expect(
      isVisibleActivityTask({
        id: "bg-1",
        title: "npm test",
        status: "completed",
      }),
    ).toBe(false);
  });

  it("keeps paused goals visible as running rows", () => {
    expect(
      isVisibleActivityTask({
        id: "goal:g1",
        title: "Fix context meter",
        status: "running",
        detail: "user paused",
      }),
    ).toBe(true);
  });
});
