import { createContext, useContext } from "react";

// Shared app state for every page:
//   meta      reference data from /api/meta (categories, box labels, lookups available...)
//   business  saved business details; setBusiness(b) after saving
//   quarter   the quarter picked in the sidebar ({ id, label, start, end, deadline, status, filed_on })
//   quarters  every quarter in the picker
//   version   bumps after any change; pages pass it to useLoad deps so they reload
//   refresh() call after saving anything that affects figures elsewhere
//   search    text in the global top-bar search box; setSearch(text) updates it
export const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);
