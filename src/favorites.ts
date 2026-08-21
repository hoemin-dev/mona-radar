const key = "mona-radar:company-favorites";
export const loadFavorites = (): Set<string> => { try { const value=JSON.parse(localStorage.getItem(key)??"[]"); return new Set(Array.isArray(value)?value:[]); } catch { return new Set(); } };
export const saveFavorites = (favorites: Set<string>) => localStorage.setItem(key,JSON.stringify([...favorites]));
