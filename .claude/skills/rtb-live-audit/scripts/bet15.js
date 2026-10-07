async page => {
  const text = await page.evaluate(() => {
    const main = document.querySelector('main') || document.body;
    return main.innerText;
  });
  const i = text.indexOf('2 Star');
  return text.slice(Math.max(0, i - 2500), i + 3500);
}
