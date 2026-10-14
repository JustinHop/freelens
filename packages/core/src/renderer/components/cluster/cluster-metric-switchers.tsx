/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { Radio, RadioGroup } from "../radio";
import styles from "./cluster-metric-switchers.module.css";
import { MetricsTimeRangeSelector } from "./metrics-time-range-selector";
import selectedMetricsTypeInjectable from "./overview/selected-metrics-type.injectable";
import selectedNodeRoleForMetricsInjectable from "./overview/selected-node-role-for-metrics.injectable";

import type { SelectedMetricsType } from "./overview/selected-metrics-type.injectable";
import type { SelectedNodeRoleForMetrics } from "./overview/selected-node-role-for-metrics.injectable";

interface Dependencies {
  selectedMetricsType: SelectedMetricsType;
  selectedNodeRoleForMetrics: SelectedNodeRoleForMetrics;
}

interface ClusterMetricSwitchersProps {
  hasCPUMetrics: boolean;
  hasMemoryMetrics: boolean;
  hasGPUMetrics: boolean;
}

const NonInjectedClusterMetricSwitchers = observer(
  ({
    selectedMetricsType,
    selectedNodeRoleForMetrics,
    hasCPUMetrics,
    hasMemoryMetrics,
    hasGPUMetrics,
  }: Dependencies & ClusterMetricSwitchersProps) => {
    const storedMetricType = selectedMetricsType.value.get();
    // A GPU selection kept from another cluster is shown as CPU, as the chart does.
    const metricType =
      !hasGPUMetrics && (storedMetricType === "gpu" || storedMetricType === "gpuMemory") ? "cpu" : storedMetricType;
    const metricRadios = [
      <Radio key="cpu" label="CPU" value="cpu" disabled={!hasCPUMetrics} />,
      <Radio key="memory" label="Memory" value="memory" disabled={!hasMemoryMetrics} />,
      ...(hasGPUMetrics
        ? [<Radio key="gpu" label="GPU" value="gpu" />, <Radio key="gpuMemory" label="GPU Memory" value="gpuMemory" />]
        : []),
    ];

    return (
      <div className={`flex gap-2 ${styles.container}`}>
        <div className="grow shrink-0 basis-0">
          <RadioGroup
            asButtons
            className="RadioGroup flex gap-2"
            value={selectedNodeRoleForMetrics.value.get()}
            onChange={selectedNodeRoleForMetrics.set}
          >
            <Radio label="Master" value="master" disabled={!selectedNodeRoleForMetrics.hasMasterNodes.get()} />
            <Radio label="Worker" value="worker" disabled={!selectedNodeRoleForMetrics.hasWorkerNodes.get()} />
          </RadioGroup>
        </div>
        <div className={styles.timeRangeBox}>
          <MetricsTimeRangeSelector />
        </div>
        <div className={`grow shrink-0 basis-0 ${styles.metricTypeBox}`}>
          <RadioGroup asButtons className="RadioGroup flex gap-2" value={metricType} onChange={selectedMetricsType.set}>
            {metricRadios}
          </RadioGroup>
        </div>
      </div>
    );
  },
);

export const ClusterMetricSwitchers = withInjectables<Dependencies, ClusterMetricSwitchersProps>(
  NonInjectedClusterMetricSwitchers,
  {
    getProps: (di, props) => ({
      ...props,
      selectedMetricsType: di.inject(selectedMetricsTypeInjectable),
      selectedNodeRoleForMetrics: di.inject(selectedNodeRoleForMetricsInjectable),
    }),
  },
);
