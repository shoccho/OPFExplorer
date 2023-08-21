let ref = null;

const getDirectoryEntriesRecursive = async (
  directoryHandle,
  relativePath = "."
) => {
  const fileHandles = [];
  const directoryHandles = [];
  const entries = {};
  // Get an iterator of the files and folders in the directory.
  const directoryIterator = directoryHandle.values();
  const directoryEntryPromises = [];
  for await (const handle of directoryIterator) {
    const nestedPath = `${relativePath}/${handle.name}`;
    if (handle.kind === "file") {
      fileHandles.push({ handle, nestedPath });
      directoryEntryPromises.push(
        handle.getFile().then((file) => {
          return {
            name: handle.name,
            kind: handle.kind,
            size: file.size,
            type: file.type,
            lastModified: file.lastModified,
            relativePath: nestedPath,
            handle,
          };
        })
      );
    } else if (handle.kind === "directory") {
      directoryHandles.push({ handle, nestedPath });
      directoryEntryPromises.push(
        (async () => {
          return {
            name: handle.name,
            kind: handle.kind,
            relativePath: nestedPath,
            entries: await getDirectoryEntriesRecursive(handle, nestedPath),
            handle,
          };
        })()
      );
    }
  }
  const directoryEntries = await Promise.all(directoryEntryPromises);
  directoryEntries.forEach((directoryEntry) => {
    entries[directoryEntry.name] = directoryEntry;
  });
  return entries;
};
const changeRef = (newHandle) => {
  console.log(newHandle)
  ref = newHandle;
};
const generateFileTree = (ul, data, depth = 0) => {
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const item = data[key];
      const li = document.createElement("li");

      li.style.marginLeft = `${depth * 20}px`;

      const icon = document.createElement("span");
      icon.className = item.kind === "directory" ? "folder-icon" : "file-icon";

      const name = document.createElement("span");
      name.textContent = item.name;
      if (item.kind === "directory")
        li.onclick = () => {
          changeRef(item.handle);
        };

      li.appendChild(icon);
      li.appendChild(name);
      console.log(item.kind);

      ul.appendChild(li);
      if (item.kind === "directory" && item.hasOwnProperty("entries")) {
        generateFileTree(ul, item.entries, depth + 1);
      }
    }
  }
};
window.onload = async () => {

  const opfsRoot = await navigator.storage.getDirectory();
  const directoryHandle = await opfsRoot.getDirectoryHandle("root", {
    create: true,
  });

  const createFileButton = document.getElementById("createFileButton");
  const createFolderButton = document.getElementById("createFolderButton");

  const fileTreeView = document.getElementById("fileTree");

  const rootFiles = await getDirectoryEntriesRecursive(directoryHandle);

  createFileButton.onclick = async () => {
    const newRow = document.createElement("li");
    newRow.innerHTML = `
      <span class="file-icon"></span>
      <input type="text" class="new-file-input" placeholder="New File" autofocus>
    `;
    fileTreeView.appendChild(newRow);

    const inputField = newRow.querySelector(".new-file-input");
    inputField.addEventListener("keyup", async function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        const fileName = inputField.value;
        newRow.innerHTML = `
          <span class="file-icon"></span>
          <span>${fileName}</span>
        `;
        const tmpHandle = await ref.getFileHandle(inputField.value, {
          create: true,
        });
        inputField.value = "";
      }
    });
  };

  createFolderButton.onclick = async () => {
    const newRow = document.createElement("li");
    newRow.innerHTML = `
          <span class="folder-icon"></span>
          <input type="text" class="new-folder-input" placeholder="New Folder" autofocus>
        `;
    fileTreeView.appendChild(newRow);

    const inputField = newRow.querySelector(".new-folder-input");
    inputField.addEventListener("keyup", async function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        const fileName = inputField.value;
        newRow.innerHTML = `
              <span class="folder-icon"></span>
              <span>${fileName}</span>
            `;
        const tmpHandle = await ref.getDirectoryHandle(inputField.value, {
          create: true,
        });
        inputField.value = "";
      }
    });
  };
  generateFileTree(fileTreeView, rootFiles);
};
