/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import helmPrometheusProviderInjectable from "@freelensapp/prometheus/src/helm-provider.injectable";
import lensPrometheusProviderInjectable from "@freelensapp/prometheus/src/lens-provider.injectable";
import operatorPrometheusProviderInjectable from "@freelensapp/prometheus/src/operator-provider.injectable";
import stacklightPrometheusProviderInjectable from "@freelensapp/prometheus/src/stacklight-provider.injectable";
import { createContainer } from "@ogre-tools/injectable";
import { beforeEach, describe, expect, it } from "vitest";

import type { PrometheusProvider } from "@freelensapp/prometheus";

const dcgmPodMetrics = [
  { name: "gpuUsage", dcgmMetric: "DCGM_FI_DEV_GPU_UTIL" },
  { name: "gpuMemoryUsage", dcgmMetric: "DCGM_FI_DEV_FB_USED" },
];

describe("DCGM pod queries in the prometheus providers", () => {
  let providers: PrometheusProvider[];

  beforeEach(() => {
    const di = createContainer("prometheus-providers-test");

    di.register(
      lensPrometheusProviderInjectable,
      helmPrometheusProviderInjectable,
      operatorPrometheusProviderInjectable,
      stacklightPrometheusProviderInjectable,
    );

    providers = [
      lensPrometheusProviderInjectable,
      helmPrometheusProviderInjectable,
      operatorPrometheusProviderInjectable,
      stacklightPrometheusProviderInjectable,
    ].map((injectable) => di.inject(injectable));
  });

  it("covers the four providers", () => {
    expect(providers.map((provider) => provider.kind)).toEqual(["lens", "helm", "operator", "stacklight"]);
  });

  const baseOpts = { category: "pods", pods: "web-.*", namespace: "apps" };

  describe.each(dcgmPodMetrics)("$name", ({ name, dcgmMetric }) => {
    describe.each([
      ["no selector", undefined],
      ["an empty selector", ""],
    ])("given %s", (_description, selector) => {
      it("groups by nothing and renames no label", () => {
        for (const provider of providers) {
          const query = provider.getQuery({ ...baseOpts, selector } as Record<string, string>, name);
          const message = `${provider.kind}: ${query}`;

          expect(query, message).not.toContain("undefined");
          expect(query, message).not.toContain("by (exported_)");
          expect(query, message).not.toContain("label_replace");
          expect(query, message).toContain(`sum(${dcgmMetric}{pod=~"web-.*",namespace="apps"`);
          expect(query, message).toContain(`}) by () or sum(${dcgmMetric}{exported_pod=~"web-.*"`);
          expect(query, message).toContain(`{exported_pod=~"web-.*",exported_namespace="apps"}) by ()`);
        }
      });

      it("produces balanced braces and parentheses", () => {
        for (const provider of providers) {
          const query = provider.getQuery({ ...baseOpts, selector } as Record<string, string>, name);
          const message = `${provider.kind}: ${query}`;

          expect(query.split("{").length, message).toBe(query.split("}").length);
          expect(query.split("(").length, message).toBe(query.split(")").length);
        }
      });
    });

    describe.each([
      {
        selector: "pod, namespace",
        renamed: (exported: string) =>
          `label_replace(label_replace(${exported}, "pod", "$1", "exported_pod", "(.*)"), "namespace", "$1", "exported_namespace", "(.*)")`,
        exportedBy: "exported_pod, exported_namespace",
      },
      {
        selector: "pod, container, namespace",
        renamed: (exported: string) =>
          `label_replace(label_replace(label_replace(${exported}, "pod", "$1", "exported_pod", "(.*)"), "container", "$1", "exported_container", "(.*)"), "namespace", "$1", "exported_namespace", "(.*)")`,
        exportedBy: "exported_pod, exported_container, exported_namespace",
      },
    ])("given the selector $selector", ({ selector, renamed, exportedBy }) => {
      it("groups both spellings and renames the exported labels back", () => {
        const exported = `sum(${dcgmMetric}{exported_pod=~"web-.*",exported_namespace="apps"}) by (${exportedBy})`;

        for (const provider of providers) {
          const query = provider.getQuery({ ...baseOpts, selector }, name);
          const message = `${provider.kind}: ${query}`;

          expect(query, message).not.toContain("undefined");
          expect(query, message).not.toContain("by (exported_)");
          expect(query, message).not.toContain(`, "",`);
          expect(query, message).toContain(`sum(${dcgmMetric}{pod=~"web-.*",namespace="apps"`);
          expect(query, message).toContain(`}) by (${selector}) or ${renamed(exported)}`);
        }
      });
    });
  });
});
