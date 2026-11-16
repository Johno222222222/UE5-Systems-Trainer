"use strict";

// The name people read. A slash is fine in a window title and a desktop entry.
// It is not fine in a file name, an app id, or the Electron userData folder.
const DISPLAY_NAME = "UE5 Systems Training Tool/Generator";

// app.setName uses this so saved projects stay in the existing data folder
// after the display name changes. Do not point userData at the new title.
const DATA_FOLDER_NAME = "UE5 System Architect";

module.exports = { DISPLAY_NAME, DATA_FOLDER_NAME };
