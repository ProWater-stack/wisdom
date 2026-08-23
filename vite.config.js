import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import dotenv from "dotenv";

dotenv.config();


const FRESHDESK_DOMAIN = "prowater.freshdesk.com";
const FRESHDESK_API_KEY = process.env.FRESHDESK_API_KEY;


const FRESHDESK_AUTH =
  "Basic " + Buffer.from(`${FRESHDESK_API_KEY}:X`).toString("base64");


const REFERRAL_API = "https://api-7ca73ntgua-el.a.run.app";


export default defineConfig({

  // REQUIRED FOR GITHUB PAGES
  base: "/wisdom/",

  plugins: [react(), tailwindcss()],


  server: {
    proxy: {

      "/api/tickets": {
        target: `https://${FRESHDESK_DOMAIN}`,
        changeOrigin: true,
        secure: true,

        rewrite: (path) =>
          path.replace(/^\/api\/tickets/, "/api/v2/tickets") +
          (path.includes("?") ? "&" : "?") +
          "per_page=100",

        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader(
              "Authorization",
              FRESHDESK_AUTH
            );

            proxyReq.setHeader(
              "Content-Type",
              "application/json"
            );
          });
        },
      },


      "/api/ticket_fields": {
        target: `https://${FRESHDESK_DOMAIN}`,
        changeOrigin: true,
        secure: true,

        rewrite: (path) =>
          path.replace(
            /^\/api\/ticket_fields/,
            "/api/v2/ticket_fields"
          ),

        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.setHeader(
              "Authorization",
              FRESHDESK_AUTH
            );

            proxyReq.setHeader(
              "Content-Type",
              "application/json"
            );
          });
        },
      },


      "/api": {
        target: REFERRAL_API,
        changeOrigin: true,
        secure: true,
      },

    },
  },
});