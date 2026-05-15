// Sprite URLs (provided by user)
export const SPRITE_URLS = {
  survivor: "https://customer-assets.emergentagent.com/job_bfa560e4-2c4e-43e7-a0a2-93ae776a7cc4/artifacts/bk62ycuh_ChatGPT%20Image%2013%20may%202026%2C%2018_26_52.png",
  infected: "https://customer-assets.emergentagent.com/job_bfa560e4-2c4e-43e7-a0a2-93ae776a7cc4/artifacts/7ptg0dk5_ChatGPT%20Image%2015%20may%202026%2C%2015_19_45.png",
};

export function loadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function loadAllSprites() {
  const [survivor, infected] = await Promise.all([
    loadImage(SPRITE_URLS.survivor),
    loadImage(SPRITE_URLS.infected),
  ]);
  return { survivor, infected };
}
