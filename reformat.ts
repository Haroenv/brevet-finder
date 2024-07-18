Bun.write(
  'brevets.json',
  JSON.stringify(
    (await Bun.file('brevets.json').json()).map(({ ...rest }) => ({
      ...rest,
    }))
  )
);
