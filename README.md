
# ghn

  GitHub notifications cli

## Example

```bash
$ TOKEN=OAUTHTOKEN ghn
1) npm/npme-installer: npme must be owner of whitelist file
2) npm/npme-installer: Vagrant Image for npmE
3) npm/npme-installer: http://npme-server/module-name/latest does not work
4) npm/npme-installer: cannot use npm search for @myco
Command: view 1
$ # opens Issue 1 in your browser
```

## Installation

```bash
$ npm install -g ghn
```

## Commands

- `view ID`: open notification `ID` in your browser
- `peek ID`: read the latest update to notification `ID` without marking it as read

## License

  MIT

