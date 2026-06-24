# create-kusto-app

Scaffold a new [Express.js-Kusto](https://github.com/taxi-tabby/express.js-kusto) project in one command.

## Usage

```bash
npm create kusto-app@latest my-app
# or
npx create-kusto-app my-app
# or
pnpm create kusto-app my-app
# or
yarn create kusto-app my-app
```

You'll be asked for a project directory, which extensions to enable (e.g. React),
your package manager, and whether to install dependencies and initialize git.

## Options

```
create-kusto-app [directory] [options]

  --react               enable the React extension
  --no-install          skip dependency installation
  --no-git              skip git initialization
  --pm <npm|pnpm|yarn>  force a package manager (default: auto-detect)
  --ref <branch|tag>    template git ref to download (default: main)
  -y, --yes             accept all defaults, no prompts
  -h, --help            show help
  -v, --version         print version
```

## What you get

- The Express.js-Kusto backend framework (TypeScript, convention-based routing, multi-DB Prisma, CRUD generator).
- Optionally, a minimal working React page wired through the `@expressjs-kusto/react` extension.

## Requirements

Node.js >= 20.

## License

ISC
