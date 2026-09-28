ARG PNPM_VERSION=12
FROM ghcr.io/pnpm/pnpm:${PNPM_VERSION} AS base
RUN pnpm runtime set node 24 -g
WORKDIR /usr/src/app

FROM base AS build
COPY . .
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run -r build
RUN pnpm deploy --filter @hewa/website --prod /prod/website

FROM base AS website
COPY --from=build /prod/website /prod/website
WORKDIR /prod/website
EXPOSE 5173
CMD ["vp", "preview", "--host", "0.0.0.0"]
