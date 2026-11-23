import type { MetadataRoute } from "next";
import { FAMILY_NAME } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: FAMILY_NAME,
    short_name: "Family",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f2f7",
    theme_color: "#f2f2f7",
    icons: [{ src: "/apple-icon", sizes: "180x180", type: "image/png" }],
  };
}
