/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { podGpuMetricTabs, podMetricTabs, podMetricTabsFor } from "./pod-charts";

import type { MetricData } from "../../../common/k8s-api/endpoints/metrics.api";
import type { PodMetricData } from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics.injectable";

const metricData = (result: MetricData["data"]["result"]): MetricData => ({
  status: "success",
  data: { resultType: "matrix", result },
});

describe("podMetricTabsFor", () => {
  it("keeps the exported pod tabs free of the GPU tabs", () => {
    expect(podMetricTabs).toEqual(["CPU", "Memory", "Network", "Filesystem"]);
    expect(podGpuMetricTabs).toEqual(["GPU", "GPU Memory"]);
  });

  it.each<[string, Partial<PodMetricData> | null | undefined]>([
    ["no metrics have loaded", undefined],
    ["the metrics are null", null],
    ["the metrics hold no GPU series", { cpuUsage: metricData([{ metric: {}, values: [[1, "1"]] }]) }],
    ["the GPU series is empty", { gpuUsage: metricData([]) }],
  ])("returns the pod tabs when %s", (_name, metrics) => {
    expect(podMetricTabsFor(metrics)).toBe(podMetricTabs);
  });

  it("adds the GPU tabs when the GPU series has results", () => {
    const metrics = { gpuUsage: metricData([{ metric: { pod: "gpu-pod" }, values: [[1, "0.5"]] }]) };

    expect(podMetricTabsFor(metrics)).toEqual([...podMetricTabs, "GPU", "GPU Memory"]);
  });
});
