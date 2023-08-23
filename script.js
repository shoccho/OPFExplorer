let ref = null;
let modal = null;
let idx = 0;

async function openModal(item) {
  const file = await item.handle.getFile()
  const text = await file.text();
  const editor = document.getElementById('editor');
  editor.value = text;  
  modal.style.display = "block";
  editor.onblur = async () => {
    const writable = await item.handle.createWritable();
    await writable.write(editor.value);
    await writable.close();
  }
}

function closeModal() {
  modal.style.display = "none";
}

const constructDirectory = (handle, nestedPath) => ({
  name: handle.name,
  kind: handle.kind,
  relativePath: nestedPath,
  entries: {},
  handle,
});

const getDirectoryEntriesRecursive = async (
  directoryHandle,
  relativePath = "."
) => {
  const fileHandles = [];
  const directoryHandles = [];
  const entries = {};
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

function insertNodeAtIndex(parentElement, newNode, index) {
  const referenceNode = parentElement.children[index];
  parentElement.insertBefore(newNode, referenceNode);
}

const createRow = (ul, item, depth, height)=>{
  const li = document.createElement("li");

  li.style.marginLeft = `${depth * 20}px`;

  const icon = document.createElement("span");
  icon.className = item.kind === "directory" ? "folder-icon" : "file-icon";

  const name = document.createElement("span");
  name.textContent = item.name;

  if (item.kind === "directory"){
    li.onclick = () => {
      changeRef(item.handle);
      idx = li;
    }
  }else{
    li.onclick = () => openModal(item);
  }
  const deleteButton = document.createElement("button");
  deleteButton.onclick = async () => {
    if(item.kind==='file'){
      await item.handle.remove();
    }else{
      await item.handle.remove({recursive: true});
    }
    window.location.reload();
  }
  deleteButton.className="delete";
  deleteButton.innerHTML=`<span class=delete-icon></span>`;
  li.appendChild(icon);
  li.appendChild(name);
  li.appendChild(deleteButton);
  
  if(height){
    insertNodeAtIndex(ul,li,height);
  }else{
    ul.appendChild(li);
  }
  if (item.kind === "directory" && item.hasOwnProperty("entries")) {
    generateFileTree(ul, item.entries, depth + 1);
  }
}

const changeRef = async (newHandle) => {
  ref = newHandle;
};

const generateFileTree = (ul, data, depth = 0) => {
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const item = data[key];
        createRow(ul,item,depth);
      }
    }
};

window.onload = async () => {
  const opfsRoot = await navigator.storage.getDirectory();
  const directoryHandle = await opfsRoot.getDirectoryHandle("root", {
    create: true,
  });
  changeRef(directoryHandle)
  const createFileButton = document.getElementById("createFileButton");
  const createFolderButton = document.getElementById("createFolderButton");

  const fileTreeView = document.getElementById("fileTree");

  const rootFiles = await getDirectoryEntriesRecursive(directoryHandle);
  modal = document.getElementById("myModal");

  createFileButton.onclick = async () => {
    const path = await opfsRoot.resolve(ref);
    const depth = path.length - 1;
    const newRow = document.createElement("li");
    newRow.innerHTML = `
      <span class="file-icon"></span>
      <input type="text" class="new-file-input" placeholder="New File" autofocus>
    `;
    
    const nodes = fileTreeView.childNodes;
    const childNodes = Array.from(nodes);
    const height = typeof idx === "number" ? idx : childNodes.findIndex(childNode => childNode === idx);
    
    newRow.style.marginLeft = `${depth * 20}px`;

    insertNodeAtIndex(fileTreeView, newRow, height)
    
    const inputField = newRow.querySelector(".new-file-input");
    inputField.addEventListener("keyup", async function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        const fileName = inputField.value;
        newRow.innerHTML = `
          <span class="file-icon"></span>
          <span>${fileName}</span>
        `;
        fileTreeView.removeChild(newRow)
        const handle = await ref.getFileHandle(inputField.value, {
          create: true,
        });
        const file = await handle.getFile();
        file.handle = handle;
        createRow(fileTreeView, file, depth, height)
        inputField.value = "";
      }
    });
  };

  createFolderButton.onclick = async () => {
    const path = await opfsRoot.resolve(ref);
    const depth = path.length - 1;
    const newRow = document.createElement("li");
    newRow.style.marginLeft = `${depth * 20}px`;
    newRow.innerHTML = `
          <span class="folder-icon"></span>
          <input type="text" class="new-folder-input" placeholder="New Folder" autofocus>
        `;
    fileTreeView.appendChild(newRow);

    const inputField = newRow.querySelector(".new-folder-input");
    inputField.addEventListener("keyup", async function (event) {
      if (event.key === "Enter") {
        fileTreeView.removeChild(newRow)
        event.preventDefault();
        const directoryName = inputField.value;
        const handle = await ref.getDirectoryHandle(directoryName, {
          create: true,
        });
        const nestedPath = path.join("/")
        const directory = constructDirectory(handle, nestedPath)
        createRow(fileTreeView, directory, depth)
        inputField.value = "";
      }
    });
  };
  generateFileTree(fileTreeView, rootFiles);

  const closeButton = document.querySelector(".close");
  closeButton.addEventListener("click", closeModal);
};
