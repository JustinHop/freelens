/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import { computed } from "mobx";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import { renderFor } from "../test-utils/renderFor";
import { ClusterMetricSwitchers } from "./cluster-metric-switchers";
import selectedMetricsTypeInjectable from "./overview/selected-metrics-type.injectable";
import selectedNodeRoleForMetricsInjectable from "./overview/selected-node-role-for-metrics.injectable";

import type { MetricType } from "./overview/storage.injectable";

vi.mock("./metrics-time-range-selector", () => ({
  MetricsTimeRangeSelector: () => <div data-testid="time-range-selector" />,
}));

function renderSwitchers(metricType: MetricType, hasGPUMetrics: boolean) {
  const di = getDiForUnitTesting();
  const render = renderFor(di);

  di.override(selectedMetricsTypeInjectable, () => ({
    value: computed(() => metricType),
    set: vi.fn(),
  }));
  di.override(selectedNodeRoleForMetricsInjectable, () => ({
    value: computed(() => "worker" as const),
    set: vi.fn(),
    nodes: computed(() => [{ getName: () => "worker-1" }] as never),
    hasMasterNodes: computed(() => true),
    hasWorkerNodes: computed(() => true),
  }));

  render(<ClusterMetricSwitchers hasCPUMetrics hasMemoryMetrics hasGPUMetrics={hasGPUMetrics} />);
}

describe("ClusterMetricSwitchers", () => {
  it("renders only the CPU and Memory radios when the cluster has no GPU metrics", () => {
    renderSwitchers("cpu", false);

    expect(screen.getByLabelText("CPU")).toBeEnabled();
    expect(screen.getByLabelText("Memory")).toBeEnabled();
    expect(screen.queryByLabelText("GPU")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("GPU Memory")).not.toBeInTheDocument();
  });

  it("checks CPU when a GPU selection is kept from another cluster without GPUs", () => {
    renderSwitchers("gpu", false);

    expect(screen.getByLabelText("CPU")).toBeChecked();
  });

  it("renders the GPU and GPU Memory radios when the cluster has GPU metrics", () => {
    renderSwitchers("gpuMemory", true);

    expect(screen.getByLabelText("CPU")).not.toBeChecked();
    expect(screen.getByLabelText("GPU")).toBeEnabled();
    expect(screen.getByLabelText("GPU Memory")).toBeChecked();
  });
});
