/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Spinner } from "@freelensapp/spinner";
import { bytesToUnits, cssNames } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { useRef, useState } from "react";
import { getMetricLastPoints, normalizeMetrics } from "../../../common/k8s-api/endpoints/metrics.api";
import { BarChart } from "../chart";
import { ZebraStripesPlugin } from "../chart/zebra-stripes.plugin";
import { ClusterMetricSwitchers } from "./cluster-metric-switchers";
import clusterOverviewMetricsInjectable from "./cluster-metrics.injectable";
import styles from "./cluster-metrics.module.scss";
import { ClusterNoMetrics } from "./cluster-no-metrics";
import selectedMetricsTimeRangeInjectable from "./overview/selected-metrics-time-range.injectable";
import selectedMetricsTypeInjectable from "./overview/selected-metrics-type.injectable";
import selectedNodeRoleForMetricsInjectable from "./overview/selected-node-role-for-metrics.injectable";
import { createMetricsTimeRangeKey } from "./overview/time-range-key";

import type { ChartOptions, ChartType, TooltipItem } from "chart.js";

import type { ClusterMetricData } from "../../../common/k8s-api/endpoints/metrics.api/request-cluster-metrics-by-node-names.injectable";
import type { IAsyncComputed } from "../../../common/utils/async-computed";
import type { SelectedMetricsTimeRange } from "./overview/selected-metrics-time-range.injectable";
import type { SelectedMetricsType } from "./overview/selected-metrics-type.injectable";
import type { SelectedNodeRoleForMetrics } from "./overview/selected-node-role-for-metrics.injectable";

interface Dependencies {
  clusterOverviewMetrics: IAsyncComputed<Partial<ClusterMetricData> | undefined>;
  selectedMetricsType: SelectedMetricsType;
  selectedNodeRoleForMetrics: SelectedNodeRoleForMetrics;
  selectedMetricsTimeRange: SelectedMetricsTimeRange;
}

const NonInjectedClusterMetrics = observer((props: Dependencies) => {
  const { clusterOverviewMetrics, selectedMetricsType, selectedNodeRoleForMetrics, selectedMetricsTimeRange } = props;
  const currentRangeKey = createMetricsTimeRangeKey(selectedMetricsTimeRange.value.get());
  const lastResolvedRangeKeyRef = useRef<string | undefined>(undefined);
  const isPending = clusterOverviewMetrics.pending.get();

  if (!isPending) {
    lastResolvedRangeKeyRef.current = currentRangeKey;
  }

  const visibleMetrics =
    isPending && currentRangeKey !== lastResolvedRangeKeyRef.current ? undefined : clusterOverviewMetrics.value.get();
  const { start: minTime, end: maxTime } = selectedMetricsTimeRange.timestamps.get();
  const [plugins] = useState([new ZebraStripesPlugin()]);
  const { memoryCapacity, cpuCapacity, gpuCapacity, gpuMemoryCapacity } = getMetricLastPoints(visibleMetrics ?? {});
  const hasGPUMetrics = typeof gpuCapacity === "number" && gpuCapacity > 0;
  const selectedType = selectedMetricsType.value.get();
  // A GPU selection kept from another cluster falls back to CPU.
  const metricType = !hasGPUMetrics && (selectedType === "gpu" || selectedType === "gpuMemory") ? "cpu" : selectedType;
  const metricNodeRole = selectedNodeRoleForMetrics.value.get();
  const hasCPUMetrics = normalizeMetrics(visibleMetrics?.cpuUsage).data.result[0].values.length > 0;
  const hasMemoryMetrics = normalizeMetrics(visibleMetrics?.memoryUsage).data.result[0].values.length > 0;
  const usageMetrics = {
    cpu: visibleMetrics?.cpuUsage,
    memory: visibleMetrics?.memoryUsage,
    gpu: visibleMetrics?.gpuUsage,
    gpuMemory: visibleMetrics?.gpuMemoryUsage,
  };
  const metricValues = normalizeMetrics(usageMetrics[metricType]).data.result[0].values;
  const colors = { cpu: "#00a7a0", memory: "#C93DCE", gpu: "#76b900", gpuMemory: "#f5a623" };
  const usageLabels = { cpu: "CPU usage", memory: "MEMORY usage", gpu: "GPU usage", gpuMemory: "GPU MEMORY usage" };
  const data = metricValues.map((value) => ({
    x: value[0] * 1000, // Convert Unix seconds to milliseconds for Chart.js
    y: parseFloat(value[1]).toFixed(3),
  }));

  const datasets = [
    {
      id: metricType + metricNodeRole,
      label: usageLabels[metricType],
      borderColor: colors[metricType],
      data,
    },
  ];
  const cpuOptions: ChartOptions = {
    scales: {
      y: {
        suggestedMax: cpuCapacity,
        ticks: {
          callback: (value) => value,
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<ChartType>) => {
            if (!context.dataIndex) {
              return "<unknown>";
            }

            const value = context.parsed.y;

            return value?.toString() ?? "<unknown>";
          },
        },
      },
    },
  };
  const memoryOptions: ChartOptions = {
    scales: {
      y: {
        suggestedMax: memoryCapacity,
        ticks: {
          callback: (value) => (!value ? 0 : bytesToUnits(parseInt(`${value}`))),
        },
      },
    },
    plugins: {
      tooltip: {
        callbacks: {
          label: (context: TooltipItem<ChartType>) => {
            if (!context.dataIndex) {
              return "<unknown>";
            }

            const value = context.parsed.y;

            return bytesToUnits(parseInt(`${value}`), { precision: 3 });
          },
        },
      },
    },
  };
  const gpuOptions: ChartOptions = {
    ...cpuOptions,
    scales: { y: { suggestedMax: gpuCapacity, ticks: { callback: (value) => value } } },
  };
  const gpuMemoryOptions: ChartOptions = {
    ...memoryOptions,
    scales: {
      y: {
        suggestedMax: gpuMemoryCapacity,
        ticks: { callback: (value) => (!value ? 0 : bytesToUnits(parseInt(`${value}`))) },
      },
    },
  };
  const options = { cpu: cpuOptions, memory: memoryOptions, gpu: gpuOptions, gpuMemory: gpuMemoryOptions }[metricType];

  const renderMetrics = () => {
    if (!metricValues.length && isPending) {
      return <Spinner center />;
    }

    const selectedCapacity = {
      cpu: cpuCapacity,
      memory: memoryCapacity,
      gpu: gpuCapacity,
      gpuMemory: gpuMemoryCapacity,
    }[metricType];

    if (!selectedCapacity) {
      return <ClusterNoMetrics className={styles.empty} />;
    }

    return (
      <BarChart
        name={`${metricNodeRole}-${metricType}`}
        options={options}
        data={{ datasets }}
        showLegend={false}
        plugins={plugins}
        className={styles.chart}
        minTime={minTime}
        maxTime={maxTime}
      />
    );
  };

  return (
    <div className={cssNames(styles.ClusterMetrics, "flex flex-col")}>
      <ClusterMetricSwitchers
        hasCPUMetrics={hasCPUMetrics}
        hasMemoryMetrics={hasMemoryMetrics}
        hasGPUMetrics={hasGPUMetrics}
      />
      {renderMetrics()}
    </div>
  );
});

export const ClusterMetrics = withInjectables<Dependencies>(NonInjectedClusterMetrics, {
  getProps: (di) => ({
    clusterOverviewMetrics: di.inject(clusterOverviewMetricsInjectable),
    selectedMetricsType: di.inject(selectedMetricsTypeInjectable),
    selectedNodeRoleForMetrics: di.inject(selectedNodeRoleForMetricsInjectable),
    selectedMetricsTimeRange: di.inject(selectedMetricsTimeRangeInjectable),
  }),
});
