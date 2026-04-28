# 🍕 pizza-pi

A pi package with a few tasty toppings (extensions) for [pi](https://pi.dev).

## Extensions

### `nerd-footer`

A status footer that uses Nerd Font glyphs to show project and LLM context at a glance.

- **Left:** folder · branch (with dirty / ahead / behind indicators)
- **Right:** model + thinking level · context usage · session cost

Requires a [Nerd Font](https://www.nerdfonts.com/) in your terminal to render the glyphs correctly.

## Install

> **Heads up:** pi packages run with full system access. Read the source before installing.

```bash
# Latest from main
pi install git:github.com/andrioid/pizza-pi

# Pin to a release tag
pi install git:github.com/andrioid/pizza-pi@v0.1.0
```

Project-local install (writes to `.pi/settings.json` so your team picks it up):

```bash
pi install -l git:github.com/andrioid/pizza-pi
```

Try it for one run without installing:

```bash
pi -e git:github.com/andrioid/pizza-pi
```

## Manage

```bash
pi list                                  # see installed packages
pi config                                # enable/disable individual extensions
pi update                                # update non-pinned packages
pi remove git:github.com/andrioid/pizza-pi
```

## Develop

Clone and point pi at the local checkout while iterating:

```bash
git clone https://github.com/andrioid/pizza-pi.git
pi -e ./pizza-pi
```

Add new extensions under `extensions/` — they're auto-discovered via the glob in `package.json` (`./extensions/*.ts`).

## License

MIT
