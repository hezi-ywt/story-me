function parseArgv(argv) {
  const tokens = [...argv];
  const flags = {};
  const positionals = [];

  let command = "";
  if (tokens.length > 0 && !tokens[0].startsWith("-")) {
    command = tokens.shift();
  }

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    if (!token.startsWith("-")) {
      positionals.push(token);
      continue;
    }

    if (token.startsWith("--")) {
      const raw = token.slice(2);
      const eqIndex = raw.indexOf("=");
      if (eqIndex >= 0) {
        const key = raw.slice(0, eqIndex);
        const value = raw.slice(eqIndex + 1);
        setFlag(flags, key, value === "" ? true : value);
        continue;
      }

      const key = raw;
      const next = tokens[i + 1];
      if (next && !next.startsWith("-")) {
        setFlag(flags, key, next);
        i += 1;
      } else {
        setFlag(flags, key, true);
      }
      continue;
    }

    const shorts = token.slice(1).split("");
    for (const short of shorts) {
      setFlag(flags, short, true);
    }
  }

  return {
    command,
    flags,
    positionals,
    json: Boolean(flags.json),
    help: Boolean(flags.help || flags.h),
  };
}

function setFlag(flags, key, value) {
  if (Object.prototype.hasOwnProperty.call(flags, key)) {
    const existing = flags[key];
    if (Array.isArray(existing)) {
      existing.push(value);
      flags[key] = existing;
    } else {
      flags[key] = [existing, value];
    }
    return;
  }
  flags[key] = value;
}

function getFlag(flags, ...names) {
  for (const name of names) {
    if (Object.prototype.hasOwnProperty.call(flags, name)) {
      return flags[name];
    }
  }
  return undefined;
}

function getFlagList(flags, ...names) {
  const value = getFlag(flags, ...names);
  if (value === undefined) {
    return [];
  }
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [String(value)];
}

export { getFlag, getFlagList, parseArgv };
