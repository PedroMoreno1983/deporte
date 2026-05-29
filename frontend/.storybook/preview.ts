import type { Preview } from "@storybook/react";
import "../app/globals.css";

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: "deporte-base",
      values: [
        { name: "deporte-base", value: "#020817" },
        { name: "surface-1",    value: "#080f20" },
        { name: "white",        value: "#ffffff" },
      ],
    },
    layout: "centered",
  },
};

export default preview;
