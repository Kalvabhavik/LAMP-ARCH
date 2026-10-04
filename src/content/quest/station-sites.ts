import type { StationId } from "@/types/game";

// Links must use https, and the target must allow framing: no X-Frame-Options DENY/SAMEORIGIN
// and CSP frame-ancestors must include this app's origin. Otherwise use "Open in new tab".
export type StationSite = { id: StationId; title: string; blurb: string; url: string };

export const STATION_SITES: Record<StationId, StationSite> = {
  linux: {
    id: "linux",
    title: "Linux",
    blurb: "The operating system layer",
    // LINK: paste the Linux page URL here, e.g. "https://your-site.com/linux".
    url: "",
  },
  apache: {
    id: "apache",
    title: "Apache",
    blurb: "The web server",
    // LINK: paste the Apache page URL here, e.g. "https://your-site.com/apache".
    url: "",
  },
  php: {
    id: "php",
    title: "PHP",
    blurb: "The application language",
    // LINK: paste the PHP page URL here, e.g. "https://your-site.com/php".
    url: "",
  },
  mysql: {
    id: "mysql",
    title: "MySQL",
    blurb: "The database",
    // LINK: paste the MySQL page URL here, e.g. "https://your-site.com/mysql".
    url: "",
  },
  lamp: {
    id: "lamp",
    title: "Introduction Hub",
    blurb: "Start here: how the world works",
   
    url: "https://canva.link/9g2kzmoi2on8b9d",
  },
  aws: {
    id: "aws",
    title: "AWS Deploy",
    blurb: "Cloud deployment",
    // LINK: paste the AWS page URL here, e.g. "https://your-site.com/aws".
    url: "",
  },
};

export const STATION_SITE_IDS = Object.keys(STATION_SITES) as StationId[];
export const SITE_STUDY_SECONDS = 20;
