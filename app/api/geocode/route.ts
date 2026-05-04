import { NextRequest, NextResponse } from "next/server";
import { getCachedCoordinate, setCachedCoordinate } from "@/app/[locale]/(protected)/pages/route-planner/planner-core/geocode-cache";
import { facilityKey } from "@/app/[locale]/(protected)/pages/route-planner/planner-core/rules";

type GoogleGeocodeResponse = {
  status: string;
  results?: Array<{
    geometry?: {
      location?: {
        lat: number;
        lng: number;
      };
    };
    formatted_address?: string;
    place_id?: string;
  }>;
  error_message?: string;
};

export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address");

    if (!address) {
      return NextResponse.json(
        { error: "Missing address parameter." },
        { status: 400 },
      );
    }

    const key = facilityKey(address);

    const cached = await getCachedCoordinate(key);
    if (cached) {
      return NextResponse.json({
        lat: cached.lat,
        lon: cached.lon,
        source: "file-cache",
      });
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Missing GOOGLE_MAPS_API_KEY in environment." },
        { status: 500 },
      );
    }

    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(address)}` +
      `&key=${encodeURIComponent(apiKey)}`;

    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Google geocoding request failed: ${res.status}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as GoogleGeocodeResponse;

    if (data.status !== "OK" || !data.results?.[0]?.geometry?.location) {
      return NextResponse.json(
        {
          error:
            data.error_message ||
            `Google geocoding failed with status: ${data.status}`,
        },
        { status: 404 },
      );
    }

    const location = data.results[0].geometry.location;
    const coord = {
      lat: location.lat,
      lon: location.lng,
    };

    await setCachedCoordinate(key, coord);

    return NextResponse.json({
      lat: coord.lat,
      lon: coord.lon,
      source: "google",
      formattedAddress: data.results[0].formatted_address ?? address,
      placeId: data.results[0].place_id ?? null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unknown geocoding error",
      },
      { status: 500 },
    );
  }
}