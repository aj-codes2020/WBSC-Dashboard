"use client";

import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import SiteBreadcrumb from "@/components/site-breadcrumb";

import { facilityKey } from "../planner-core/rules";
import { geocodeAddress } from "../planner-core/geo";
import { osrmRoute } from "../planner-core/osrm";
import type { Coord } from "../planner-core/types";

export default function TestOsrmPage() {
  const [fromAddress, setFromAddress] = useState(
    "590 Missouri Ave, Jeffersonville, IN, United States",
  );
  const [toAddress, setToAddress] = useState(
    "7509 Charlestown Pike, Charlestown, IN 47111, United States",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    fromCoord: Coord;
    toCoord: Coord;
    miles: number;
    minutes: number;
  } | null>(null);

  const handleTest = async () => {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const cache: Record<string, Coord> = {};

      const fromCoord = await geocodeAddress(fromAddress, cache);
      if (!fromCoord) {
        throw new Error(`Could not geocode origin address: ${fromAddress}`);
      }

      cache[facilityKey(fromAddress)] = fromCoord;

      const toCoord = await geocodeAddress(toAddress, cache);
      if (!toCoord) {
        throw new Error(`Could not geocode destination address: ${toAddress}`);
      }

      cache[facilityKey(toAddress)] = toCoord;

      const route = await osrmRoute([fromCoord, toCoord]);

      setResult({
        fromCoord,
        toCoord,
        miles: Number(route.miles.toFixed(2)),
        minutes: Number(route.minutes.toFixed(1)),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown OSRM error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SiteBreadcrumb />

      <Card>
        <CardHeader>
          <CardTitle>OSRM Test</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">From</label>
            <input
              value={fromAddress}
              onChange={(e) => setFromAddress(e.target.value)}
              className="w-full rounded border p-3 text-sm"
              placeholder="Enter origin address"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">To</label>
            <input
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              className="w-full rounded border p-3 text-sm"
              placeholder="Enter destination address"
            />
          </div>

          <Button onClick={handleTest} disabled={loading}>
            {loading ? "Testing..." : "Test OSRM Drive Time"}
          </Button>

          {error && (
            <div className="rounded border border-red-300 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded border p-4 space-y-2 text-sm">
              <div>
                <strong>Origin coordinates:</strong> {result.fromCoord.lat},{" "}
                {result.fromCoord.lon}
              </div>
              <div>
                <strong>Destination coordinates:</strong> {result.toCoord.lat},{" "}
                {result.toCoord.lon}
              </div>
              <div>
                <strong>Drive time:</strong> {result.minutes} minutes
              </div>
              <div>
                <strong>Drive distance:</strong> {result.miles} miles
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}