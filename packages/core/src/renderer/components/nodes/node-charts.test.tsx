/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { computed } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import activeThemeInjectable from "../../themes/active.injectable";
import selectedMetricsTimeRangeInjectable from "../cluster/overview/selected-metrics-time-range.injectable";
import { ResourceMetricsContext } from "../resource-metrics";
import { renderFor } from "../test-utils/renderFor";
import { hasGpu, NodeCharts } from "./node-charts";

const barChartMock = vi.fn();

vi.mock("../../../common/k8s-api/endpoints/metrics.api", () => ({
  isMetricsEmpty: () => false,
  normalizeMetrics: (metric: unknown) => metric,
}));

vi.mock("../chart", () => ({
  BarChart: (props: unknown) => {
    barChartMock(props);

    return null;
  },
}));

const metric = {
  status: "",
  data: {
    resultType: "",
    result: [{ values: [[1_710_000_000, "1"]] }],
  },
};

const metrics = {
  memoryUsage: metric,
  workloadMemoryUsage: metric,
  memoryRequests: metric,
  memoryCapacity: metric,
  memoryAllocatableCapacity: metric,
  cpuUsage: metric,
  cpuRequests: metric,
  cpuCapacity: metric,
  cpuAllocatableCapacity: metric,
  gpuUsage: metric,
  gpuRequests: metric,
  gpuCapacity: metric,
  gpuAllocatableCapacity: metric,
  gpuMemoryUsage: metric,
  gpuMemoryCapacity: metric,
  podUsage: metric,
  podCapacity: metric,
  fsSize: metric,
  fsUsage: metric,
};

describe("NodeCharts", () => {
  beforeEach(() => {
    barChartMock.mockReset();
  });

  it("passes selected time-range bounds to BarChart", () => {
    const di = getDiForUnitTesting();
    const render = renderFor(di);

    di.override(activeThemeInjectable, () =>
      computed(
        () =>
          ({
            colors: {
              chartCapacityColor: "#123456",
            },
          }) as never,
      ),
    );
    di.override(selectedMetricsTimeRangeInjectable, () => ({
      timestamps: {
        get: () => ({ start: 100, end: 200, range: 100 }),
      },
    }));

    render(
      <ResourceMetricsContext.Provider
        value={{
          metrics: metrics as never,
          tab: "CPU",
          object: { getId: () => "node-id", getName: () => "node-name" } as never,
          isPending: false,
        }}
      >
        <NodeCharts />
      </ResourceMetricsContext.Provider>,
    );

    expect(barChartMock).toHaveBeenCalledWith(
      expect.objectContaining({
        minTime: 100,
        maxTime: 200,
      }),
    );

    const barChartProps = barChartMock.mock.calls[0][0];
    const firstDatasetPoint = barChartProps.data.datasets[0].data[0];

    expect(firstDatasetPoint.x).toBe(1_710_000_000_000);
  });

  describe.each([
    {
      tab: "GPU",
      datasets: [
        { id: "node-id-gpuUsage", borderColor: "#76b900" },
        { id: "node-id-gpuRequests", borderColor: "#30b24d" },
        { id: "node-id-gpuAllocatableCapacity", borderColor: "#032b4d" },
        { id: "node-id-gpuCapacity", borderColor: "#123456" },
      ],
    },
    {
      tab: "GPU Memory",
      datasets: [
        { id: "node-id-gpuMemoryUsage", borderColor: "#f5a623" },
        { id: "node-id-gpuMemoryCapacity", borderColor: "#123456" },
      ],
    },
  ] as const)("$tab tab", ({ tab, datasets }) => {
    it("charts the series of the tab", () => {
      const di = getDiForUnitTesting();
      const render = renderFor(di);

      di.override(activeThemeInjectable, () =>
        computed(() => ({ colors: { chartCapacityColor: "#123456" } }) as never),
      );
      di.override(selectedMetricsTimeRangeInjectable, () => ({
        timestamps: {
          get: () => ({ start: 100, end: 200, range: 100 }),
        },
      }));

      render(
        <ResourceMetricsContext.Provider
          value={{
            metrics: metrics as never,
            tab,
            object: { getId: () => "node-id", getName: () => "node-name" } as never,
            isPending: false,
          }}
        >
          <NodeCharts />
        </ResourceMetricsContext.Provider>,
      );

      const barChartProps = barChartMock.mock.calls[0][0];

      expect(barChartProps.name).toBe(`node-name-metric-${tab}`);
      expect(
        barChartProps.data.datasets.map(({ id, borderColor }: { id: string; borderColor: string }) => ({
          id,
          borderColor,
        })),
      ).toEqual(datasets);
      expect(barChartProps.data.datasets[0].data[0].x).toBe(1_710_000_000_000);
    });
  });
});

describe("hasGpu", () => {
  const nodeWith = (capacity?: Record<string, string>) => ({ status: { capacity } }) as never;

  it("is true for a node that reports a GPU", () => {
    expect(hasGpu(nodeWith({ cpu: "8", "nvidia.com/gpu": "4" }))).toBe(true);
  });

  it("is false without the GPU resource, with zero GPUs, or without a status", () => {
    expect(hasGpu(nodeWith({ cpu: "8" }))).toBe(false);
    expect(hasGpu(nodeWith({ "nvidia.com/gpu": "0" }))).toBe(false);
    expect(hasGpu(nodeWith())).toBe(false);
    expect(hasGpu({} as never)).toBe(false);
  });
});
