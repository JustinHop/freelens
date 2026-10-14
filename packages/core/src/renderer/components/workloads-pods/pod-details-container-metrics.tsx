/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react-lite";
import { TimeRangedResourceMetrics } from "../resource-metrics";
import { ContainerCharts } from "./container-charts";
import podContainerMetricsInjectable from "./container-metrics.injectable";

import type { Container, Pod } from "@freelensapp/kube-object";

import type { PodMetricData } from "../../../common/k8s-api/endpoints/metrics.api/request-pod-metrics.injectable";
import type { IAsyncComputed } from "../../../common/utils/async-computed";
import type { AtLeastOneMetricTab } from "../resource-metrics";

interface ContainerMetricsProps {
  container: Container;
  pod: Pod;
}

interface Dependencies {
  podContainerMetrics: IAsyncComputed<Partial<PodMetricData>>;
}

const gpuResourceName = "nvidia.com/gpu";

const NonInjectedPodDetailsContainerMetrics = observer(
  ({ pod, container, podContainerMetrics }: ContainerMetricsProps & Dependencies) => {
    const hasGpu = [container.resources?.limits, container.resources?.requests].some(
      (resources) => resources?.[gpuResourceName] !== undefined,
    );
    const tabs: AtLeastOneMetricTab = hasGpu
      ? ["CPU", "Memory", "Filesystem", "GPU", "GPU Memory"]
      : ["CPU", "Memory", "Filesystem"];

    return (
      <TimeRangedResourceMetrics object={pod} tabs={tabs} metrics={podContainerMetrics}>
        <ContainerCharts containerName={container.name} />
      </TimeRangedResourceMetrics>
    );
  },
);

export const PodDetailsContainerMetrics = withInjectables<Dependencies, ContainerMetricsProps>(
  NonInjectedPodDetailsContainerMetrics,
  {
    getProps: (di, props) => ({
      ...props,
      podContainerMetrics: di.inject(podContainerMetricsInjectable, {
        pod: props.pod,
        container: props.container,
      }),
    }),
  },
);
