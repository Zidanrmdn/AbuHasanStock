/* === DATABASE === */
let usersDB = JSON.parse(localStorage.getItem("usersDB")) || {};
let inventory = JSON.parse(localStorage.getItem("inventory")) || [];
let incomingHistory = JSON.parse(localStorage.getItem("incomingHistory")) || [];
let outgoingHistory = JSON.parse(localStorage.getItem("outgoingHistory")) || [];
let currentUser = null;
let isSignUpMode = false;

/* === LOGIKA PECAHAN INPUT === */
function parseFraction(text) {
  if (!text) return 0;
  text = text.toString().replace(",", ".").trim();
  if (text.includes("/")) {
    let parts = text.split(" ");
    if (parts.length > 1) {
      let whole = parseFloat(parts[0]);
      let fracParts = parts[1].split("/");
      return whole + parseFloat(fracParts[0]) / parseFloat(fracParts[1]);
    } else {
      let fracParts = text.split("/");
      return parseFloat(fracParts[0]) / parseFloat(fracParts[1]);
    }
  }
  return parseFloat(text) || 0;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

/* === FORMAT STOCK (Kd & Ls saja) === */
function formatStockKdLs(stockPcs) {
  stockPcs = Number(stockPcs) || 0;

  const k = Math.floor(stockPcs / 20);
  const remAfterKodi = stockPcs % 20;

  const wholeLs = Math.floor(remAfterKodi / 12);
  const pcsRemainder = remAfterKodi % 12;

  let parts = [];
  if (k > 0) parts.push(`${k} Kd`);

  if (wholeLs > 0 || pcsRemainder > 0 || k === 0) {
    if (pcsRemainder === 0) {
      parts.push(`${wholeLs} Ls`);
    } else {
      let num = pcsRemainder,
        den = 12;
      const g = gcd(num, den);
      num /= g;
      den /= g;
      parts.push(
        wholeLs > 0 ? `${wholeLs} ${num}/${den} Ls` : `${num}/${den} Ls`,
      );
    }
  }
  return parts.join(", ");
}

/* === FORMAT BARANG KELUAR (Kd) === */
function formatOutKodi(outPcs) {
  const kd = Math.floor((Number(outPcs) || 0) / 20);
  return `${kd} Kd`;
}

/* === FORMAT BARANG DATANG (Kd) === */
function formatInKodi(inPcs) {
  const kd = Math.floor((Number(inPcs) || 0) / 20);
  return `${kd} Kd`;
}

/* === NAV & AUTH === */
function handleLogin() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  if (isSignUpMode) {
    if (usersDB[user]) return alert("Username terdaftar!");
    usersDB[user] = {
      password: pass,
      role: document.getElementById("reg-role").value,
    };
    localStorage.setItem("usersDB", JSON.stringify(usersDB));
    alert("Berhasil!");
    toggleForm();
  } else {
    if (usersDB[user] && usersDB[user].password === pass) {
      currentUser = { username: user, role: usersDB[user].role };
      showDashboard();
    } else alert("Username/Password salah!");
  }
}

function showDashboard() {
  document.getElementById("login-container").style.display = "none";
  document.getElementById("main-navbar").style.display = "flex";
  document.getElementById("dashboard").style.display = "block";
  document.getElementById("user-info").innerText = `👤 ${currentUser.username}`;

  if (currentUser.role === "admin") {
    document
      .querySelectorAll(".admin-only")
      .forEach((el) => (el.style.display = "block"));
  }

  renderCategorySelect();
  renderUI();
  showPage("home");
}

function showPage(page) {
  ["home", "akun", "jenis", "barang-datang", "barang-keluar"].forEach((p) => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.style.display = p === page ? "block" : "none";
  });

  if (page === "barang-datang") {
    renderHistoryUI();
    populateArrivalSelect();
    document.getElementById("arrivalDate").valueAsDate = new Date();
  }

  if (page === "barang-keluar") {
    renderOutgoingHistoryUI();
    populateOutgoingSelect();
    document.getElementById("outDate").valueAsDate = new Date();
  }
}

/* === CORE LOGIC === */
function updateStock(type) {
  const idx = document.getElementById("itemSelect").value;
  const rawQty = document.getElementById("quantity").value;
  const mult = parseInt(document.getElementById("unitSelect").value);
  const qtyDecimal = parseFraction(rawQty);

  if (idx === "" || isNaN(qtyDecimal) || qtyDecimal <= 0)
    return alert("Jumlah tidak valid!");

  const change = Math.round(qtyDecimal * mult);

  if (typeof inventory[idx].outStock !== "number") inventory[idx].outStock = 0;
  if (typeof inventory[idx].inStock !== "number") inventory[idx].inStock = 0;

  if (type === "in") {
    inventory[idx].stock += change;
    inventory[idx].inStock += change; // ✅ catat barang datang
  } else {
    if (inventory[idx].stock - change < 0) return alert("Stok tidak cukup!");
    inventory[idx].stock -= change;
    inventory[idx].outStock += change;
  }

  inventory[idx].lastUpdate = new Date().toLocaleString();
  saveAndRender();
  document.getElementById("quantity").value = "";
}

function addIncomingStock() {
  const idx = document.getElementById("arrivalItemSelect").value;
  const rawQty = document.getElementById("arrivalQty").value;
  const mult = parseInt(document.getElementById("arrivalUnit").value);
  const date = document.getElementById("arrivalDate").value;
  const unitText =
    document.getElementById("arrivalUnit").options[
      document.getElementById("arrivalUnit").selectedIndex
    ].text;
  const qtyDecimal = parseFraction(rawQty);

  if (idx === "" || isNaN(qtyDecimal) || qtyDecimal <= 0)
    return alert("Isi jumlah valid!");

  const total = Math.round(qtyDecimal * mult);
  inventory[idx].stock += total;

  if (typeof inventory[idx].inStock !== "number") inventory[idx].inStock = 0;
  inventory[idx].inStock += total; // ✅ catat barang datang

  inventory[idx].lastUpdate = new Date().toLocaleString();

  incomingHistory.unshift({
    date,
    name: inventory[idx].name,
    displayQty: rawQty,
    unit: unitText,
    note: document.getElementById("arrivalNote").value,
  });

  localStorage.setItem("incomingHistory", JSON.stringify(incomingHistory));
  saveAndRender();
  renderHistoryUI();

  document.getElementById("arrivalQty").value = "";
  document.getElementById("arrivalNote").value = "";
}

function addOutgoingStock() {
  const idx = document.getElementById("outItemSelect").value;
  const rawQty = document.getElementById("outQty").value;
  const mult = parseInt(document.getElementById("outUnit").value);
  const date = document.getElementById("outDate").value;
  const unitText =
    document.getElementById("outUnit").options[
      document.getElementById("outUnit").selectedIndex
    ].text;
  const qtyDecimal = parseFraction(rawQty);

  if (idx === "" || isNaN(qtyDecimal) || qtyDecimal <= 0)
    return alert("Isi jumlah valid!");

  const total = Math.round(qtyDecimal * mult);

  if (typeof inventory[idx].outStock !== "number") inventory[idx].outStock = 0;
  if (typeof inventory[idx].inStock !== "number") inventory[idx].inStock = 0;
  if (inventory[idx].stock - total < 0) return alert("Stok tidak cukup!");

  inventory[idx].stock -= total;
  inventory[idx].outStock += total;
  inventory[idx].lastUpdate = new Date().toLocaleString();

  outgoingHistory.unshift({
    date,
    name: inventory[idx].name,
    displayQty: rawQty,
    unit: unitText,
    note: document.getElementById("outNote").value,
  });

  localStorage.setItem("outgoingHistory", JSON.stringify(outgoingHistory));
  saveAndRender();
  renderOutgoingHistoryUI();

  document.getElementById("outQty").value = "";
  document.getElementById("outNote").value = "";
}

/* === HAPUS ITEM === */
function deleteItem(index) {
  if (!currentUser || currentUser.role !== "admin")
    return alert("Hanya admin yang bisa menghapus!");
  if (confirm("Yakin ingin menghapus barang ini?")) {
    inventory.splice(index, 1);
    localStorage.setItem("inventory", JSON.stringify(inventory));
    renderUI();
    populateArrivalSelect();
    populateOutgoingSelect();
  }
}

/* === CETAK PDF INVENTARIS === */
function downloadPDF() {
  if (!inventory || inventory.length === 0)
    return alert("Inventaris masih kosong.");
  if (!window.jspdf || !window.jspdf.jsPDF)
    return alert(
      "Library PDF belum terbaca. Pastikan jsPDF di HTML sudah ada.",
    );

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const now = new Date();
  const tanggal = now.toLocaleString();

  doc.setFontSize(14);
  doc.text("ABU HASAN STOCK - Daftar Inventaris", 14, 15);
  doc.setFontSize(10);
  doc.text(`Dicetak: ${tanggal}`, 14, 22);
  if (currentUser?.username) doc.text(`User: ${currentUser.username}`, 14, 27);

  const rows = inventory.map((it, idx) => [
    idx + 1,
    it.name,
    formatStockKdLs(it.stock || 0),
    formatInKodi(it.inStock || 0),
    formatOutKodi(it.outStock || 0),
    it.lastUpdate || "-",
  ]);

  doc.autoTable({
    startY: 32,
    head: [
      [
        "No",
        "Nama Barang",
        "Stok (Kd, Ls)",
        "Barang Datang (Kd)",
        "Barang Keluar (Kd)",
        "Update Terakhir",
      ],
    ],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [233, 236, 239], textColor: [33, 37, 41] },
  });

  doc.save(`Inventaris_AbuHasan_${now.toISOString().slice(0, 10)}.pdf`);
}

/* === CETAK PDF RIWAYAT BARANG DATANG === */
function downloadIncomingPDF() {
  if (!incomingHistory || incomingHistory.length === 0)
    return alert("Riwayat barang datang masih kosong.");
  if (!window.jspdf || !window.jspdf.jsPDF)
    return alert(
      "Library PDF belum terbaca. Pastikan jsPDF sudah ada di HTML.",
    );

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

  const now = new Date();
  const tanggal = now.toLocaleString();

  doc.setFontSize(14);
  doc.text("ABU HASAN STOCK - Riwayat Barang Datang", 14, 15);
  doc.setFontSize(10);
  doc.text(`Dicetak: ${tanggal}`, 14, 22);
  if (currentUser?.username) doc.text(`User: ${currentUser.username}`, 14, 27);

  const rows = incomingHistory.map((it, idx) => [
    idx + 1,
    it.date || "-",
    it.name || "-",
    `${it.displayQty || "-"} ${it.unit || ""}`.trim(),
    it.note || "-",
  ]);

  doc.autoTable({
    startY: 32,
    head: [["No", "Tanggal", "Nama Barang", "Jumlah", "Keterangan"]],
    body: rows,
    styles: { fontSize: 9, cellPadding: 2 },
    headStyles: { fillColor: [233, 236, 239], textColor: [33, 37, 41] },
  });

  doc.save(`Riwayat_BarangDatang_${now.toISOString().slice(0, 10)}.pdf`);
}

/* === RENDERING + SEARCH LIST === */
function renderUI() {
  const body = document.getElementById("stockTableBody");
  body.innerHTML = "";

  const searchInput = document.getElementById("itemSearch");
  const dataList = document.getElementById("itemOptions");
  const hiddenIdx = document.getElementById("itemSelect");
  if (dataList) dataList.innerHTML = "";
  if (hiddenIdx) hiddenIdx.value = "";

  inventory.forEach((it, i) => {
    const stokText = formatStockKdLs(it.stock || 0);
    const datangText = formatInKodi(it.inStock || 0);
    const keluarText = formatOutKodi(it.outStock || 0);

    const aksiHtml =
      currentUser && currentUser.role === "admin"
        ? `<button onclick="deleteItem(${i})"
            style="background:#e74c3c; padding:6px 10px; font-size:0.75rem; border-radius:6px;">
            Hapus
          </button>`
        : "-";

    body.innerHTML += `<tr>
      <td>${it.name}</td>
      <td align="center"><b>${stokText}</b></td>
      <td align="center"><b>${datangText}</b></td>
      <td align="center"><b>${keluarText}</b></td>
      <td align="center" style="font-size:0.75rem; color:gray;">${it.lastUpdate || "-"}</td>
      <td align="center">${aksiHtml}</td>
    </tr>`;

    if (dataList) dataList.innerHTML += `<option value="${it.name}"></option>`;
  });

  if (searchInput && hiddenIdx) {
    searchInput.oninput = () => {
      const val = (searchInput.value || "").trim().toLowerCase();
      const found = inventory.findIndex(
        (x) => (x.name || "").toLowerCase() === val,
      );
      hiddenIdx.value = found >= 0 ? String(found) : "";
    };
  }
}

function populateArrivalSelect() {
  const searchInput = document.getElementById("arrivalItemSearch");
  const dataList = document.getElementById("arrivalItemOptions");
  const hiddenIdx = document.getElementById("arrivalItemSelect");

  if (dataList) dataList.innerHTML = "";
  if (hiddenIdx) hiddenIdx.value = "";

  inventory.forEach((it) => {
    if (dataList) dataList.innerHTML += `<option value="${it.name}"></option>`;
  });

  if (searchInput && hiddenIdx) {
    searchInput.oninput = () => {
      const val = (searchInput.value || "").trim().toLowerCase();
      const found = inventory.findIndex(
        (x) => (x.name || "").toLowerCase() === val,
      );
      hiddenIdx.value = found >= 0 ? String(found) : "";
    };
  }
}

function populateOutgoingSelect() {
  const searchInput = document.getElementById("outItemSearch");
  const dataList = document.getElementById("outItemOptions");
  const hiddenIdx = document.getElementById("outItemSelect");

  if (dataList) dataList.innerHTML = "";
  if (hiddenIdx) hiddenIdx.value = "";

  inventory.forEach((it) => {
    if (dataList) dataList.innerHTML += `<option value="${it.name}"></option>`;
  });

  if (searchInput && hiddenIdx) {
    searchInput.oninput = () => {
      const val = (searchInput.value || "").trim().toLowerCase();
      const found = inventory.findIndex(
        (x) => (x.name || "").toLowerCase() === val,
      );
      hiddenIdx.value = found >= 0 ? String(found) : "";
    };
  }
}

function renderHistoryUI() {
  const body = document.getElementById("historyTableBody");
  if (incomingHistory.length === 0) {
    body.innerHTML =
      '<tr><td colspan="5" align="center">Belum ada riwayat.</td></tr>';
    return;
  }
  body.innerHTML = incomingHistory
    .map(
      (it) => `
    <tr>
      <td>${it.date}</td>
      <td>${it.name}</td>
      <td align="center">${it.displayQty}</td>
      <td align="center">${it.unit}</td>
      <td>${it.note || "-"}</td>
    </tr>`,
    )
    .join("");
}

function renderOutgoingHistoryUI() {
  const body = document.getElementById("outHistoryTableBody");
  if (!body) return;

  if (outgoingHistory.length === 0) {
    body.innerHTML =
      '<tr><td colspan="5" align="center">Belum ada riwayat.</td></tr>';
    return;
  }

  body.innerHTML = outgoingHistory
    .map(
      (it) => `
    <tr>
      <td>${it.date}</td>
      <td>${it.name}</td>
      <td align="center">${it.displayQty}</td>
      <td align="center">${it.unit}</td>
      <td>${it.note || "-"}</td>
    </tr>`,
    )
    .join("");
}

function renderCategorySelect() {
  const select = document.getElementById("itemCategory");
  const cats = JSON.parse(localStorage.getItem("categories")) || [
    "Peci",
    "Sarung",
    "Sejadah",
  ];
  select.innerHTML = cats
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");
}

function addItem() {
  const cat = document.getElementById("itemCategory").value;
  const det = document.getElementById("itemDetail").value;
  const qty = parseFraction(document.getElementById("initialStock").value);
  const mult = parseInt(document.getElementById("initialUnitSelect").value);

  if (!cat || !det) return alert("Isi data!");

  inventory.push({
    name: `${cat} - ${det}`,
    stock: Math.round(qty * mult),
    inStock: 0,
    outStock: 0,
    lastUpdate: new Date().toLocaleString(),
  });

  saveAndRender();
  populateArrivalSelect();
  populateOutgoingSelect();
}

function addCategory() {
  const input = document.getElementById("newCategory");
  const val = (input.value || "").trim();
  if (!val) return alert("Isi kategori!");
  const cats = JSON.parse(localStorage.getItem("categories")) || [
    "Peci",
    "Sarung",
    "Sejadah",
  ];
  if (cats.includes(val)) return alert("Kategori sudah ada!");
  cats.push(val);
  localStorage.setItem("categories", JSON.stringify(cats));
  input.value = "";
  renderCategorySelect();
  alert("Kategori ditambahkan!");
}

function saveAndRender() {
  localStorage.setItem("inventory", JSON.stringify(inventory));
  renderUI();
  populateArrivalSelect();
  populateOutgoingSelect();
}

function logout() {
  location.reload();
}

function clearHistory() {
  if (confirm("Hapus riwayat barang datang?")) {
    incomingHistory = [];
    localStorage.setItem("incomingHistory", "[]");
    renderHistoryUI();
  }
}

function clearOutgoingHistory() {
  if (confirm("Hapus riwayat barang keluar?")) {
    outgoingHistory = [];
    localStorage.setItem("outgoingHistory", "[]");
    renderOutgoingHistoryUI();
  }
}

function toggleForm() {
  isSignUpMode = !isSignUpMode;
  document.getElementById("form-title").innerText = isSignUpMode
    ? "📦 DAFTAR AKUN"
    : "📦 ABU HASAN LOGIN";
  document.getElementById("reg-role").style.display = isSignUpMode
    ? "block"
    : "none";
  document.getElementById("main-btn").innerText = isSignUpMode
    ? "Daftar"
    : "Masuk";
  document.getElementById("toggle-link").innerText = isSignUpMode
    ? "Kembali Login"
    : "Daftar Sekarang";
}

function forgotPassword() {
  alert("Password default: 12345");
}
function updateAccount() {
  alert("Fitur update akun belum diaktifkan.");
}
