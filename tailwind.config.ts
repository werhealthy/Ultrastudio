import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        tim: {
          blue: "#122AC2",
          deep: "#001136",
          connected: "#0033A1",
          sky: "#29A9FF",
          red: "#EB0028",
          soft: "#F6F6FD",
        },
      },
      height: {
        13: "3.25rem",
      },
    },
  },
  plugins: [],
};

export default config;
