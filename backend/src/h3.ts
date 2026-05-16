import type { Request, Response } from "express";
import h3 from "h3-js";
import geojsonvt from "geojson-vt";
import vtpbf from "vt-pbf";
import {
  ZOOM_TO_H3_RESOLUTION,
  getH3CellsForTile,
  stableValue,
} from "./utils.js";
import type { Feature } from "geojson";

export const h3TileRender = (req: Request, res: Response) => {
  const { params } = req;
  const x = Number(params.x);
  const y = Number(params.y);
  const z = Number(params.z);

  const h3Resolution = ZOOM_TO_H3_RESOLUTION[z] ?? 8;

  let cells: string[];
  try {
    cells = getH3CellsForTile(x, y, z, h3Resolution);
  } catch (err) {
    console.error(err);
    return res.status(204).end();
  }

  const features: Feature[] = cells.map((cell) => {
    const boundary = h3.cellToBoundary(cell, true); // true = geojson format

    return {
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [boundary],
      },
      properties: {
        h3: cell,
        resolution: h3.getResolution(cell),
        // custom data here (value, count, etc.)
        // deterministic so the same cell gets the same value across adjacent tiles
        value: stableValue(cell),
      },
    };
  });

  const tileIndex = geojsonvt(
    { type: "FeatureCollection", features },
    {
      maxZoom: z, // index only needs tiles at this zoom level
      buffer: 64,
      tolerance: 3,
    },
  );
  const tile = tileIndex.getTile(z, x, y);

  res.set("Content-Type", "application/vnd.mapbox-vector-tile");

  if (!tile) {
    return res.status(204).end();
  }

  // @types/vt-pbf incorrectly declares the layer type as the full GeoJSONVT
  // index; the implementation actually reads `.features` from a Tile object.
  const pbf = vtpbf.fromGeojsonVt({
    "h3-layer": tile as unknown as ReturnType<typeof geojsonvt>,
  });
  res.set("Content-Encoding", "identity");
  res.send(Buffer.from(pbf));
};
