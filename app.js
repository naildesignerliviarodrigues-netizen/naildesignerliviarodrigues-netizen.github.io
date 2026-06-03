// v46-fotos-compressao-segura
const services = [
    { id: "gel-tips", name: "Gel na tips", price: 120, durationText: "1h30 a 2h", durationMinutes: 120 },
    { id: "fibra-vidro", name: "Fibra de vidro", price: 140, durationText: "2h", durationMinutes: 120 },
    { id: "manutencao-gel-tips", name: "Manutenção - Gel na tips", price: 110, durationText: "1h30 a 2h", durationMinutes: 120 },
    { id: "manutencao-fibra-vidro", name: "Manutenção - Fibra de vidro", price: 120, durationText: "1h30 a 2h", durationMinutes: 120 },
    { id: "banho-gel", name: "Banho de gel", price: 90, durationText: "1h30 a 2h", durationMinutes: 120 },
    { id: "esmaltacao-gel", name: "Esmaltação em gel", price: 70, durationText: "1h", durationMinutes: 60 },
    { id: "manicure-pedicure", name: "Manicure e pedicure", price: 55, durationText: "aprox. 2h", durationMinutes: 120 },
    { id: "manicure", name: "Manicure", price: 35, durationText: "40min a 1h", durationMinutes: 60 },
    { id: "pedicure", name: "Pedicure", price: 35, durationText: "40min a 1h", durationMinutes: 60 },
    { id: "postica", name: "Postiça", price: 35, durationText: "1h", durationMinutes: 60 },
    { id: "postica-realista", name: "Postiça realista", price: 60, durationText: "1h30", durationMinutes: 90 },
    { id: "plastica-pes", name: "Plástica dos pés", price: 70, durationText: "2h", durationMinutes: 120 },
    { id: "depilacao-axila", name: "Depilação de axila", price: 30, durationText: "30min", durationMinutes: 30 }
];

const defaultWorks = ["assets/trabalho_1.png", "assets/trabalho_2.png", "assets/trabalho_3.png"];
let works = [...defaultWorks];

let currentPhoto = 0;
let selectedService = null;
let selectedDate = null;
let selectedDateBR = "";
let selectedDateObj = null;
let selectedTime = null;
let clientData = { name: "", phone: "", cpf: "" };
let pixPayload = "";
let currentBookingId = null;
let pixCountdownTimer = null;

const FIREBASE_DB_URL = "https://studio-livia-rodrigues-default-rtdb.firebaseio.com";
const BACKEND_URL = "https://livia-agendamentos-backend.onrender.com";
const PENDING_EXPIRE_MINUTES = 10;
let appointmentsCache = [];
let firebaseOnline = true;
let appointmentsRealtimeTimer = null;

const screens = {
    home: document.getElementById("homeScreen"),
    services: document.getElementById("servicesScreen"),
    date: document.getElementById("dateScreen"),
    slots: document.getElementById("slotsScreen"),
    client: document.getElementById("clientScreen"),
    summary: document.getElementById("summaryScreen"),
    pix: document.getElementById("pixScreen"),
    success: document.getElementById("successScreen"),
    myAppointments: document.getElementById("myAppointmentsScreen"),
    admin: document.getElementById("adminScreen"),
    adminPhotos: document.getElementById("adminPhotosScreen")
};

const business = {
    start: "07:30",
    weekdayEnd: "17:30",
    saturdayEnd: "16:00",
    lunchStart: "11:30",
    lunchEnd: "13:00",
    daysAhead: 10
};

const dayNames = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function money(value){
    return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function showToast(message, type = "success"){
    let toast = document.getElementById("appToast");
    if(!toast){
        toast = document.createElement("div");
        toast.id = "appToast";
        toast.className = "app-toast";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `app-toast show ${type}`;
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(() => {
        toast.classList.remove("show");
    }, 2200);
}


function depositValue(service){
    return service.price * 0.30;
}

function showScreen(screenName){
    Object.values(screens).forEach(screen => screen.classList.remove("active"));
    screens[screenName].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderServices(){
    const list = document.getElementById("servicesList");
    list.className = "service-list";
    list.innerHTML = "";

    services.forEach(service => {
        const row = document.createElement("section");
        row.className = "service-row";
        row.innerHTML = `
            <div class="service-info">
                <h2>${service.name}</h2>
                <p>${money(service.price)} • duração: ${service.durationText}</p>
                <div class="deposit">Sinal 30%: <strong>${money(depositValue(service))}</strong></div>
            </div>
            <button class="service-arrow" aria-label="Selecionar ${service.name}">›</button>
        `;
        row.addEventListener("click", () => selectService(service.id));
        list.appendChild(row);
    });
}

function selectService(serviceId){
    selectedService = services.find(service => service.id === serviceId);
    selectedDate = null;
    selectedDateBR = "";
    selectedDateObj = null;
    selectedTime = null;

    document.getElementById("dateServiceName").textContent = selectedService.name;
    document.getElementById("dateServiceDuration").textContent = `Duração: ${selectedService.durationText} • Sinal: ${money(depositValue(selectedService))}`;
    renderDates();
    showScreen("date");
}

function timeToMinutes(time){
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
}

function minutesToTime(minutes){
    const h = String(Math.floor(minutes / 60)).padStart(2, "0");
    const m = String(minutes % 60).padStart(2, "0");
    return `${h}:${m}`;
}

function formatDateBR(date){
    return date.toLocaleDateString("pt-BR");
}

function dateKey(date){
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function parseBRDate(text){
    const match = text.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if(!match) return null;
    const [, dd, mm, yyyy] = match;
    const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    if(date.getDate() !== Number(dd) || date.getMonth() !== Number(mm) - 1 || date.getFullYear() !== Number(yyyy)) return null;
    return date;
}

function isWorkday(date){
    const day = date.getDay();
    return day >= 2 && day <= 6;
}

function isTodayAfterBusinessEnd(){
    const now = new Date();
    const today = new Date();

    if(!isWorkday(today)) return false;

    const endTime = businessEndForDate(today);
    const endMinutes = timeToMinutes(endTime);
    const nowMinutes = (now.getHours() * 60) + now.getMinutes();

    return nowMinutes >= endMinutes;
}

function generateWorkingDates(){
    const dates = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const hideToday = isTodayAfterBusinessEnd();

    for(let i = 0; dates.length < business.daysAhead && i < 40; i++){
        const date = new Date(today);
        date.setDate(today.getDate() + i);

        if(i === 0 && hideToday){
            continue;
        }

        if(isWorkday(date)) dates.push(date);
    }
    return dates;
}

function overlaps(startA, endA, startB, endB){
    return startA < endB && endA > startB;
}

function isLunchBlocked(start, end){
    // Sábado tem atendimento contínuo, sem intervalo para almoço.
    if(selectedDateObj && selectedDateObj.getDay && selectedDateObj.getDay() === 6){
        return false;
    }

    return overlaps(start, end, timeToMinutes(business.lunchStart), timeToMinutes(business.lunchEnd));
}

function businessEndForDate(date){
    // Sábado fecha mais cedo; terça a sexta fecha 17:30.
    if(date && date.getDay && date.getDay() === 6){
        return business.saturdayEnd;
    }
    return business.weekdayEnd;
}

function generateTimesForService(service){
    const times = [];
    const start = timeToMinutes(business.start);
    const end = timeToMinutes(businessEndForDate(selectedDateObj));
    const step = 30;

    for(let current = start; current + service.durationMinutes <= end; current += step){
        times.push(minutesToTime(current));
    }
    return times;
}

function appointmentEndMinutes(item){
    const service = services.find(s => s.id === item.serviceId || s.name === item.service);
    const duration = Number(item.durationMinutes || service?.durationMinutes || 60);
    return timeToMinutes(item.time) + duration;
}

function slotStatus(time){
    const start = timeToMinutes(time);
    const end = start + selectedService.durationMinutes;

    if(isLunchBlocked(start, end)){
        return { status: "unavailable", label: "INDISPONÍVEL" };
    }

    const activeAppointments = getStoredAppointments().filter(item => {
        const normalized = String(item.status || "").toLowerCase();
        return item.date === selectedDateBR && !normalized.includes("cancel") && !normalized.includes("expir");
    });

    for(const item of activeAppointments){
        const apStart = timeToMinutes(item.time);
        const apEnd = appointmentEndMinutes(item);

        if(overlaps(start, end, apStart, apEnd)){
            const exactStart = start === apStart;
            const normalized = String(item.status || "").toLowerCase();

            if(exactStart && normalized.includes("confirm")){
                return { status: "confirmed", label: "CONFIRMADO" };
            }

            if(exactStart){
                return { status: "temporary", label: "RESERVA TEMP." };
            }

            return { status: "unavailable", label: "INDISPONÍVEL" };
        }
    }

    return { status: "available", label: "DISPONÍVEL" };
}

function renderDates(){
    const dateList = document.getElementById("dateList");
    dateList.innerHTML = "";

    generateWorkingDates().forEach(date => {
        const btn = document.createElement("button");
        btn.className = "date-btn";
        btn.innerHTML = `<strong>${dayNames[date.getDay()]}</strong><span>${formatDateBR(date)}</span>`;
        btn.addEventListener("click", () => pickDate(date));
        dateList.appendChild(btn);
    });
}

function pickDate(date){
    selectedDate = dateKey(date);
    selectedDateBR = formatDateBR(date);
    selectedDateObj = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    selectedTime = null;
    renderTimes();
    showScreen("slots");
}

function renderTimes(){
    const timeList = document.getElementById("timeList");
    timeList.innerHTML = "";
    selectedTime = null;

    document.getElementById("slotsSubtitle").textContent = `${selectedDateBR} • ${selectedService.name} • ${selectedService.durationText}`;

    const times = generateTimesForService(selectedService);

    times.forEach(time => {
        const visual = slotStatus(time);
        const btn = document.createElement("button");
        btn.className = `time-btn ${visual.status}`;
        btn.innerHTML = `${time}<br><small>${visual.label}</small>`;

        if(visual.status === "available"){
            btn.addEventListener("click", () => {
                selectedTime = time;
                document.querySelectorAll(".time-btn").forEach(item => item.classList.remove("selected"));
                btn.classList.add("selected");
                setTimeout(() => {
                    showScreen("client");
                }, 120);
            });
        }else{
            btn.disabled = true;
        }

        timeList.appendChild(btn);
    });

    if(times.length === 0){
        timeList.innerHTML = `<p class="empty-message">Nenhum horário disponível para este serviço nessa data.</p>`;
    }
}


function refreshWorksFromStorage(){
    const extraPhotos = getAdminPhotos ? getAdminPhotos() : [];
    works = [...extraPhotos, ...defaultWorks].slice(0, 12);
}

function renderHomeWorks(){
    refreshWorksFromStorage();

    const grid = document.querySelector(".works-grid");
    if(!grid) return;

    const visibleWorks = works.length > 0 ? works : defaultWorks;
    const loopWorks = visibleWorks.length > 3
        ? [...visibleWorks, ...visibleWorks, ...visibleWorks]
        : [...visibleWorks, ...visibleWorks, ...visibleWorks];

    grid.innerHTML = loopWorks.map((src, index) => {
        const realIndex = index % visibleWorks.length;
        return `<img src="${src}" alt="Trabalho recente ${realIndex + 1}" class="work-photo" data-index="${realIndex}">`;
    }).join("");

    grid.querySelectorAll(".work-photo").forEach((img) => {
        img.addEventListener("click", () => {
            currentPhoto = Number(img.dataset.index);
            updatePhoto();
            photoModal.classList.add("active");
        });
    });

    requestAnimationFrame(() => {
        if(visibleWorks.length > 1){
            grid.scrollLeft = Math.floor(grid.scrollWidth / 3);
        }
    });
}

/* Fotos recentes */
const photoModal = document.getElementById("photoModal");
const modalImage = document.getElementById("modalImage");
const photoCounter = document.getElementById("photoCounter");

function updatePhoto(){
    modalImage.src = works[currentPhoto];
    photoCounter.textContent = `Foto ${currentPhoto + 1} de ${works.length}`;
}


document.getElementById("closePhoto").addEventListener("click", () => photoModal.classList.remove("active"));
document.getElementById("prevPhoto").addEventListener("click", () => { currentPhoto = (currentPhoto - 1 + works.length) % works.length; updatePhoto(); });
document.getElementById("nextPhoto").addEventListener("click", () => { currentPhoto = (currentPhoto + 1) % works.length; updatePhoto(); });
photoModal.addEventListener("click", (event) => { if(event.target === photoModal) photoModal.classList.remove("active"); });

/* Botões */
document.getElementById("btnInstagram").addEventListener("click", () => window.open("https://www.instagram.com/liviarodrigues_studio", "_blank"));
document.getElementById("btnMap").addEventListener("click", () => window.open("https://www.google.com/maps/search/?api=1&query=Galeria%20Santos%20Rua%20Aurora%20Gl%C3%B3ria%20Vila%20Velha%20ES", "_blank"));
document.getElementById("btnSchedule").addEventListener("click", () => showScreen("services"));
document.getElementById("btnMyAppointments").addEventListener("click", () => { renderAppointmentsEmpty(); showScreen("myAppointments"); });
document.getElementById("btnBackHome").addEventListener("click", () => showScreen("home"));
document.getElementById("btnBackServices").addEventListener("click", () => showScreen("services"));
document.getElementById("btnBackDate").addEventListener("click", () => showScreen("date"));

document.getElementById("customDateInput").addEventListener("input", (event) => {
    let value = event.target.value.replace(/\D/g, "").slice(0, 8);
    if(value.length > 4) value = `${value.slice(0,2)}/${value.slice(2,4)}/${value.slice(4)}`;
    else if(value.length > 2) value = `${value.slice(0,2)}/${value.slice(2)}`;
    event.target.value = value;
});

document.getElementById("btnCustomDate").addEventListener("click", () => {
    const date = parseBRDate(document.getElementById("customDateInput").value);
    if(!date){ alert("Digite a data assim: 30/05/2026"); return; }
    const today = new Date(); today.setHours(0,0,0,0);
    if(date < today){ alert("Escolha uma data de hoje para frente."); return; }
    if(!isWorkday(date)){ alert("Atendimento somente de terça a sábado."); return; }
    pickDate(date);
});



function formatCpf(value){
    const d = value.replace(/\D/g, "").slice(0, 11);
    if(d.length > 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
    if(d.length > 6) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
    if(d.length > 3) return `${d.slice(0,3)}.${d.slice(3)}`;
    return d;
}

function formatPhone(value){
    const d = value.replace(/\D/g, "").slice(0, 11);
    if(d.length > 10) return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
    if(d.length > 6) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
    if(d.length > 2) return `(${d.slice(0,2)}) ${d.slice(2)}`;
    if(d.length > 0) return `(${d}`;
    return d;
}

function onlyDigits(value){
    return String(value || "").replace(/\D/g, "");
}

function fillSummary(){
    document.getElementById("summaryClientName").textContent = clientData.name;
    document.getElementById("summaryServiceName").textContent = selectedService.name;
    document.getElementById("summaryDateTime").textContent = `${selectedDateBR} às ${selectedTime}`;
    document.getElementById("summaryTotal").textContent = money(selectedService.price);
    document.getElementById("summaryDeposit").textContent = money(depositValue(selectedService));
}



function ensurePixQrElementsV36(){
    const pixScreen = document.getElementById("pixScreen");
    if(!pixScreen) return { qrImg: null, qrBox: null };

    let qrCard = pixScreen.querySelector(".qr-card");
    if(!qrCard){
        const row = pixScreen.querySelector(".pix-compact-row");
        if(row){
            qrCard = document.createElement("section");
            qrCard.className = "qr-card";
            row.prepend(qrCard);
        }
    }

    if(qrCard && !document.getElementById("pixQrImg")){
        qrCard.innerHTML = `
            <div id="pixQrBox" class="pix-real-qr-box">
                <img id="pixQrImg" alt="QR Code Pix" />
            </div>
        `;
    }

    const qrBox = document.getElementById("pixQrBox");
    const qrImg = document.getElementById("pixQrImg");
    return { qrImg, qrBox };
}

function applyPixQrLayoutV36(){
    const styleId = "livia_v36_qr_photo_fix";
    if(!document.getElementById(styleId)){
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            #pixScreen .pix-compact-row{
                display:grid!important;
                grid-template-columns: 35% 65%!important;
                align-items:center!important;
                gap:0!important;
                overflow:hidden!important;
            }
            #pixScreen .qr-card{
                display:flex!important;
                align-items:center!important;
                justify-content:center!important;
                width:100%!important;
                height:100%!important;
                padding:10px 0 10px 10px!important;
                box-sizing:border-box!important;
                overflow:hidden!important;
            }
            #pixQrBox.pix-real-qr-box{
                width:156px!important;
                height:156px!important;
                max-width:100%!important;
                background:#fff!important;
                border-radius:18px!important;
                display:flex!important;
                align-items:center!important;
                justify-content:center!important;
                padding:8px!important;
                box-sizing:border-box!important;
                overflow:hidden!important;
                margin:0 auto!important;
            }
            #pixQrImg{
                width:100%!important;
                height:100%!important;
                max-width:132px!important;
                max-height:132px!important;
                object-fit:contain!important;
                display:block!important;
                margin:auto!important;
                position:static!important;
                transform:none!important;
            }
            #pixScreen .pix-safe-card{
                min-width:0!important;
                box-sizing:border-box!important;
                padding:14px 14px!important;
            }
            #pixScreen .pix-safe-card p{
                line-height:1.22!important;
            }
            #adminPhotoInput{
                display:none;
            }
        `;
        document.head.appendChild(style);
    }
    ensurePixQrElementsV36();
}
document.addEventListener("DOMContentLoaded", applyPixQrLayoutV36);
setInterval(applyPixQrLayoutV36, 1000);


function setPixQRCode(pixPayload, encodedImage){
    applyPixQrLayoutV36();
    const { qrImg, qrBox } = ensurePixQrElementsV36();

    if(encodedImage && qrImg){
        const imgSrc = String(encodedImage).startsWith("data:")
            ? encodedImage
            : `data:image/png;base64,${encodedImage}`;
        qrImg.src = imgSrc;
        qrImg.style.display = "block";
        if(qrBox) qrBox.classList.add("real-qr");
        return;
    }

    if(qrImg){
        qrImg.style.display = "none";
    }
}

function fillPix(){
    document.getElementById("pixServiceName").textContent = selectedService.name;
    document.getElementById("pixDateTime").textContent = `${selectedDateBR} às ${selectedTime}`;
    document.getElementById("pixDeposit").textContent = money(depositValue(selectedService));
    pixPayload = `PIX STUDIO LIVIA RODRIGUES | ${selectedService.name} | ${selectedDateBR} ${selectedTime} | SINAL ${money(depositValue(selectedService))}`;
}



function firebaseUrl(path){
    return `${FIREBASE_DB_URL.replace(/\/$/, "")}/${String(path).replace(/^\/|\/$/g, "")}.json`;
}

function normalizeFirebaseData(data){
    if(!data || typeof data !== "object") return [];
    return Object.entries(data).map(([id, value]) => {
        if(value && typeof value === "object"){
            return { id, ...value };
        }
        return null;
    }).filter(Boolean);
}

function statusToWeb(status){
    const s = String(status || "").toLowerCase();
    if(s === "pago" || s.includes("confirm")) return "Confirmado";
    if(s.includes("cancel")) return "Cancelado";
    if(s.includes("expir")) return "Expirado";
    if(s.includes("reservado_aguardando_pagamento") || s.includes("tempor")) return "Reserva temporária";
    return status || "Reserva temporária";
}

function statusToFirebase(status){
    const s = String(status || "").toLowerCase();
    if(s.includes("confirm")) return "pago";
    if(s.includes("cancel")) return "cancelado";
    if(s.includes("expir")) return "expirado";
    return "reservado_aguardando_pagamento";
}

function normalizeAppointmentFromFirebase(item){
    const service = services.find(s => s.id === item.serviceId || s.name === item.service);
    return {
        id: item.id,
        clientName: item.clientName || item.client_name || "Cliente",
        phone: item.phone || item.client_phone || "",
        cpf: item.cpf || item.client_cpf_cnpj || "",
        service: item.service || service?.name || "",
        serviceId: item.serviceId || service?.id || "",
        price: Number(item.price || 0),
        deposit: Number(item.deposit || 0),
        durationMinutes: Number(item.durationMinutes || item.duration_block || service?.durationMinutes || 60),
        durationText: item.durationText || item.duration_label || service?.durationText || "",
        date: item.date || "",
        time: item.time || "",
        status: statusToWeb(item.status),
        createdAt: item.createdAt || item.created_at || "",
        expiresAt: item.expiresAt || item.expires_at || "",
        pixPayload: item.pixPayload || item.pix_payload || "",
        paymentStatus: item.paymentStatus || item.payment_status || "",
        asaasPaymentId: item.asaasPaymentId || item.asaas_payment_id || "",
        raw: item
    };
}

function appointmentToFirebase(item){
    return {
        id: item.id,
        created_at: item.createdAt || new Date().toLocaleString("pt-BR"),
        expires_at: item.expiresAt || new Date(Date.now() + PENDING_EXPIRE_MINUTES * 60 * 1000).toLocaleString("pt-BR"),
        client_name: item.clientName || "",
        client_phone: onlyDigits(item.phone || ""),
        client_cpf_cnpj: onlyDigits(item.cpf || ""),
        service: item.service || "",
        serviceId: item.serviceId || "",
        price: Number(item.price || 0),
        deposit: String(item.deposit || 0),
        duration_label: item.durationText || "",
        duration_block: Number(item.durationMinutes || 60),
        date: item.date || "",
        time: item.time || "",
        status: statusToFirebase(item.status),
        admin_seen: false,
        payment_provider: "Asaas",
        payment_status: item.paymentStatus || "waiting_payment",
        pix_payload: item.pixPayload || "",
        asaas_payment_id: item.asaasPaymentId || ""
    };
}

function saveLocalBackup(items){
    appointmentsCache = Array.isArray(items) ? items : [];
    localStorage.setItem("livia_appointments", JSON.stringify(appointmentsCache));
}

function loadLocalBackup(){
    try{
        const data = JSON.parse(localStorage.getItem("livia_appointments") || "[]");
        return Array.isArray(data) ? data : [];
    }catch(error){
        return [];
    }
}

async function fetchAppointmentsFromFirebase(){
    const response = await fetch(firebaseUrl("appointments"), { cache: "no-store" });
    if(!response.ok) throw new Error(`Firebase HTTP ${response.status}`);
    const data = await response.json();
    const items = normalizeFirebaseData(data).map(normalizeAppointmentFromFirebase);
    firebaseOnline = true;
    saveLocalBackup(items);
    return items;
}

function loadAppointmentsFromFirebase(){
    fetchAppointmentsFromFirebase()
        .then(items => {
            appointmentsCache = items;
            rerenderCurrentDataScreens();
        })
        .catch(error => {
            firebaseOnline = false;
            console.warn("Firebase indisponível, usando backup local:", error);
        });
}

async function patchAppointmentFirebase(id, fields){
    const response = await fetch(firebaseUrl(`appointments/${id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields)
    });
    if(!response.ok) throw new Error(`Firebase PATCH ${response.status}`);
    return response.json();
}

async function putAppointmentFirebase(item){
    const response = await fetch(firebaseUrl(`appointments/${item.id}`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(appointmentToFirebase(item))
    });
    if(!response.ok) throw new Error(`Firebase PUT ${response.status}`);
    return response.json();
}

async function deleteAppointmentFirebase(id){
    const response = await fetch(firebaseUrl(`appointments/${id}`), {
        method: "DELETE"
    });
    if(!response.ok) throw new Error(`Firebase DELETE ${response.status}`);
    return response.json();
}


function showPaidSuccess(item){
    const successService = document.getElementById("successService");
    const successDateTime = document.getElementById("successDateTime");

    if(successService){
        successService.textContent = item?.service || selectedService?.name || "---";
    }

    if(successDateTime){
        const date = item?.date || selectedDateBR || "";
        const time = item?.time || selectedTime || "";
        successDateTime.textContent = date && time ? `${date} às ${time}` : "---";
    }

    const successTitle = document.querySelector("#successScreen h1, #successScreen h2, #successScreen .success-title");
    if(successTitle){
        successTitle.textContent = "Pagamento confirmado!";
    }

    const successText = document.querySelector("#successScreen p");
    if(successText){
        successText.textContent = "Seu horário foi confirmado com sucesso. A reserva já está garantida.";
    }

    showScreen("success");
}


function rerenderCurrentDataScreens(){
    const active = document.querySelector(".screen.active")?.id || "";
    if(active === "slotsScreen" && selectedService && selectedDateBR){
        renderTimes();
    }
    if(active === "pixScreen" && currentBookingId){
        const item = getStoredAppointments().find(ap => ap.id === currentBookingId);
        const normalizedStatus = String(item?.status || "").toLowerCase();
        const normalizedPayment = String(item?.paymentStatus || "").toLowerCase();

        if(
            normalizedStatus.includes("confirm") ||
            normalizedStatus === "pago" ||
            normalizedPayment === "paid" ||
            normalizedPayment.includes("paid")
        ){
            if(pixCountdownTimer){
                clearInterval(pixCountdownTimer);
                pixCountdownTimer = null;
            }
            currentBookingId = null;
            showToast("Pagamento confirmado! Reserva garantida ✓");
            setTimeout(() => showPaidSuccess(item), 700);
            return;
        }
    }
    if(active === "myAppointmentsScreen"){
        const cpf = onlyDigits(document.getElementById("lookupCpf")?.value || "");
        const phone = onlyDigits(document.getElementById("lookupPhone")?.value || "");
        if(cpf.length >= 11 || phone.length >= 10) renderAppointments();
    }
    if(active === "adminScreen"){
        renderAdmin();
    }
}

function startAppointmentsRealtime(){
    if(appointmentsRealtimeTimer) clearInterval(appointmentsRealtimeTimer);
    loadAppointmentsFromFirebase();
    appointmentsRealtimeTimer = setInterval(loadAppointmentsFromFirebase, 5000);
}


function getStoredAppointments(){
    let data = appointmentsCache.length ? appointmentsCache : loadLocalBackup();

    let changed = false;
    const now = Date.now();

    const cleaned = data.map(item => {
        const normalized = String(item.status || "").toLowerCase();
        if(
            normalized.includes("reserva tempor") &&
            item.expiresAt &&
            new Date(item.expiresAt).getTime() <= now
        ){
            changed = true;
            return { ...item, status: "Expirado", expiredAt: new Date().toISOString() };
        }
        return item;
    });

    if(changed){
        saveStoredAppointments(cleaned);
    }

    return cleaned;
}

function saveStoredAppointments(items){
    saveLocalBackup(items);
}


async function createAsaasPaymentForBooking(booking){
    const payload = {
        appointment_id: booking.id,
        customer_name: booking.clientName,
        customer_phone: onlyDigits(booking.phone),
        customer_cpf_cnpj: onlyDigits(booking.cpf),
        value: Number(booking.deposit || 0),
        description: `Sinal de agendamento - ${booking.service || "Studio Lívia Rodrigues"}`
    };

    const response = await fetch(`${BACKEND_URL.replace(/\/$/, "")}/create-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    let data = {};
    try{
        data = await response.json();
    }catch(error){
        throw new Error("Resposta inválida do servidor Render.");
    }

    if(!response.ok || !data.ok){
        const msg = data.error || data.message || data.step || JSON.stringify(data).slice(0, 300);
        throw new Error(msg || "Erro ao criar Pix no Asaas.");
    }

    return data;
}

function createTemporaryAppointment(){
    currentBookingId = `web-${Date.now()}`;
    const booking = {
        id: currentBookingId,
        clientName: clientData.name,
        phone: clientData.phone,
        cpf: clientData.cpf,
        service: selectedService.name,
        serviceId: selectedService.id,
        price: selectedService.price,
        deposit: depositValue(selectedService),
        durationMinutes: selectedService.durationMinutes,
        durationText: selectedService.durationText,
        date: selectedDateBR,
        time: selectedTime,
        status: "Reserva temporária",
        paymentStatus: "waiting_payment",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + PENDING_EXPIRE_MINUTES * 60 * 1000).toISOString()
    };

    const items = getStoredAppointments().filter(item => item.id !== booking.id);
    items.unshift(booking);
    saveStoredAppointments(items);

    putAppointmentFirebase(booking)
        .then(() => loadAppointmentsFromFirebase())
        .catch(error => {
            firebaseOnline = false;
            console.warn("Erro salvando no Firebase:", error);
            alert("Reserva salva neste aparelho, mas ainda não sincronizou com a nuvem. Verifique a internet.");
        });

    return booking;
}

function statusClass(status){
    const normalized = String(status || "").toLowerCase();
    if(normalized.includes("confirm")) return "confirmed";
    if(normalized.includes("cancel")) return "cancelled";
    if(normalized.includes("expir")) return "expired";
    return "temporary";
}

function appointmentCard(item){
    return `
        <section class="appointment-card ${statusClass(item.status)}">
            <div class="appointment-top">
                <div>
                    <span>Serviço</span>
                    <strong>${item.service}</strong>
                </div>
                <em>${item.status}</em>
            </div>

            <div class="appointment-details">
                <div><span>Data</span><strong>${item.date}</strong></div>
                <div><span>Horário</span><strong>${item.time}</strong></div>
                <div><span>Total</span><strong>${money(Number(item.price || 0))}</strong></div>
                <div><span>Sinal</span><strong>${money(Number(item.deposit || 0))}</strong></div>
            </div>

            <div class="appointment-client">
                <span>Cliente</span>
                <strong>${item.clientName || "Cliente"}</strong>
            </div>

            ${!["Cancelado","Expirado"].includes(item.status) ? `<button class="cancel-appointment-btn" data-id="${item.id}">CANCELAR AGENDAMENTO</button>` : ""}
        </section>
    `;
}

function renderAppointmentsEmpty(){
    document.getElementById("appointmentsResult").innerHTML = "";
    document.getElementById("lookupCpf").value = "";
    document.getElementById("lookupPhone").value = "";
}

function renderAppointments(){
    const cpf = onlyDigits(document.getElementById("lookupCpf").value);
    const phone = onlyDigits(document.getElementById("lookupPhone").value);
    const result = document.getElementById("appointmentsResult");

    if(cpf.length < 11 && phone.length < 10){
        alert("Digite seu CPF ou telefone com DDD para consultar.");
        return;
    }

    const matches = getStoredAppointments().filter(item => {
        const sameCpf = cpf.length === 11 && onlyDigits(item.cpf) === cpf;
        const samePhone = phone.length >= 10 && onlyDigits(item.phone) === phone;
        return sameCpf || samePhone;
    });

    if(matches.length === 0){
        result.innerHTML = `
            <section class="empty-appointments">
                <strong>Nenhum agendamento encontrado</strong>
                <p>Confira se o CPF ou telefone foi digitado igual ao usado na reserva.</p>
            </section>
        `;
        return;
    }

    result.innerHTML = matches.map(appointmentCard).join("");
    result.querySelectorAll(".cancel-appointment-btn").forEach(button => {
        button.addEventListener("click", () => cancelAppointment(button.dataset.id));
    });
}

let pendingCancelId = null;

function openCancelModal(id){
    pendingCancelId = id;
    document.getElementById("cancelModal").classList.add("active");
}

function closeCancelModal(){
    pendingCancelId = null;
    document.getElementById("cancelModal").classList.remove("active");
}

function cancelAppointment(id){
    openCancelModal(id);
}

function confirmCancelAppointment(){
    if(!pendingCancelId) return;

    const id = pendingCancelId;
    const items = getStoredAppointments().map(item => {
        if(item.id === id){
            return { ...item, status: "Cancelado", cancelledAt: new Date().toISOString(), paymentStatus: "cancelled_by_client" };
        }
        return item;
    });

    saveStoredAppointments(items);
    patchAppointmentFirebase(id, {
        status: "cancelado",
        cancelled_at: new Date().toLocaleString("pt-BR"),
        payment_status: "cancelled_by_client",
        admin_seen: false
    }).catch(error => console.warn("Erro cancelando no Firebase:", error));

    const wasPixReservation = currentBookingId === id;

    if(wasPixReservation && pixCountdownTimer){
        clearInterval(pixCountdownTimer);
        pixCountdownTimer = null;
    }

    closeCancelModal();

    const active = document.querySelector(".screen.active")?.id || "";
    if(active === "myAppointmentsScreen"){
        renderAppointments();
    }

    loadAppointmentsFromFirebase();

    if(wasPixReservation){
        currentBookingId = null;
        showScreen("home");
        showToast("Reserva cancelada. Horário disponível novamente.");
    }
}


function formatCountdown(ms){
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const seconds = String(totalSeconds % 60).padStart(2, "0");
    return `${minutes}:${seconds}`;
}

function startPixCountdown(){
    if(pixCountdownTimer){
        clearInterval(pixCountdownTimer);
        pixCountdownTimer = null;
    }

    const label = document.getElementById("pixCountdown");
    if(!label || !currentBookingId) return;

    const update = () => {
        const item = getStoredAppointments().find(ap => ap.id === currentBookingId);
        if(!item || !item.expiresAt){
            label.textContent = "10:00";
            return;
        }

        const normalizedStatus = String(item.status || "").toLowerCase();
        const normalizedPayment = String(item.paymentStatus || "").toLowerCase();

        if(
            normalizedStatus.includes("confirm") ||
            normalizedStatus === "pago" ||
            normalizedPayment === "paid" ||
            normalizedPayment.includes("paid")
        ){
            clearInterval(pixCountdownTimer);
            pixCountdownTimer = null;
            label.textContent = "PAGO";
            currentBookingId = null;
            showToast("Pagamento confirmado! Reserva garantida ✓");
            setTimeout(() => showPaidSuccess(item), 700);
            return;
        }

        const remaining = new Date(item.expiresAt).getTime() - Date.now();
        label.textContent = formatCountdown(remaining);

        if(remaining <= 0){
            clearInterval(pixCountdownTimer);
            pixCountdownTimer = null;
            label.textContent = "EXPIRADO";
            getStoredAppointments();
        }
    };

    update();
    pixCountdownTimer = setInterval(update, 1000);
}

const clientNameInput = document.getElementById("clientName");
const clientPhoneInput = document.getElementById("clientPhone");
const clientCpfInput = document.getElementById("clientCpf");

clientPhoneInput.addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
});

clientCpfInput.addEventListener("input", (event) => {
    event.target.value = formatCpf(event.target.value);
});


const lookupCpfInput = document.getElementById("lookupCpf");
const lookupPhoneInput = document.getElementById("lookupPhone");

lookupCpfInput.addEventListener("input", (event) => {
    event.target.value = formatCpf(event.target.value);
});

lookupPhoneInput.addEventListener("input", (event) => {
    event.target.value = formatPhone(event.target.value);
});

document.getElementById("btnLookupAppointments").addEventListener("click", renderAppointments);
document.getElementById("btnBackHomeFromAppointments").addEventListener("click", () => showScreen("home"));

document.getElementById("btnClientContinue").addEventListener("click", () => {
    const name = clientNameInput.value.trim();
    const phone = onlyDigits(clientPhoneInput.value);
    const cpf = onlyDigits(clientCpfInput.value);

    if(name.length < 3){ alert("Digite o nome da cliente."); return; }
    if(phone.length < 10){ alert("Digite um número válido com DDD."); return; }
    if(cpf.length !== 11){ alert("Digite um CPF válido para gerar o Pix."); return; }

    clientData = { name, phone, cpf };
    fillSummary();
    showScreen("summary");
});

document.getElementById("btnGeneratePix").addEventListener("click", () => {
    const modal = document.getElementById("loadingModal");
    modal.classList.add("active");
    setTimeout(() => {
        modal.classList.remove("active");
        fillPix();
        createTemporaryAppointment();
        showScreen("pix");
        startPixCountdown();
    }, 1300);
});

document.getElementById("btnCopyPix").addEventListener("click", async () => {
    try{
        await navigator.clipboard.writeText(pixPayload);
        showToast("Pix copiado com sucesso ✓");
    }catch(error){
        showToast("Não consegui copiar automaticamente.", "error");
    }
});

document.getElementById("btnFinish").addEventListener("click", () => {
    if(!currentBookingId){
        showScreen("home");
        return;
    }
    openCancelModal(currentBookingId);
});

document.getElementById("btnSuccessHome").addEventListener("click", () => showScreen("home"));
document.getElementById("btnSuccessMyAppointments").addEventListener("click", () => {
    renderAppointmentsEmpty();
    showScreen("myAppointments");
});
document.getElementById("btnBackSlots").addEventListener("click", () => showScreen("slots"));
document.getElementById("btnBackClient").addEventListener("click", () => showScreen("client"));



/* Painel da Lívia */
let adminFilter = "all";
let logoTapCount = 0;
let logoTapTimer = null;

function isStatus(item, key){
    const s = String(item.status || "").toLowerCase();
    if(key === "temporary") return s.includes("reserva tempor");
    if(key === "confirmed") return s.includes("confirm");
    if(key === "cancelled") return s.includes("cancel");
    if(key === "expired") return s.includes("expir");
    return false;
}

function parseBRDateToDate(dateText){
    const parsed = parseBRDate(dateText);
    if(parsed) return parsed;
    return new Date();
}

function isSameBRDate(dateText, date){
    return dateText === formatDateBR(date);
}

function isWithinNextDays(dateText, days){
    const d = parseBRDateToDate(dateText);
    d.setHours(0,0,0,0);
    const today = new Date();
    today.setHours(0,0,0,0);
    const max = new Date(today);
    max.setDate(today.getDate() + days);
    return d >= today && d <= max;
}

function currentMonthMatch(dateText){
    const d = parseBRDateToDate(dateText);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function sortAppointments(items){
    return [...items].sort((a,b) => {
        const da = parseBRDateToDate(a.date);
        const db = parseBRDateToDate(b.date);
        const ta = timeToMinutes(a.time || "00:00");
        const tb = timeToMinutes(b.time || "00:00");
        return (da - db) || (ta - tb);
    });
}

function adminBookingCard(item){
    const status = String(item.status || "Reserva temporária");
    const phoneDigits = onlyDigits(item.phone);
    const waLink = phoneDigits ? `https://wa.me/55${phoneDigits}` : "#";
    const canCancel = !isStatus(item, "cancelled") && !isStatus(item, "expired");

    return `
        <section class="admin-booking-card ${statusClass(status)}">
            <div class="admin-booking-head">
                <strong>${item.date || "--"} às ${item.time || "--"}</strong>
                <em>${status}</em>
            </div>

            <p>Cliente: <b>${item.clientName || "Cliente"}</b></p>
            <p>WhatsApp: <b>${item.phone || "Não informado"}</b></p>
            <p>Serviço: <b>${item.service || "--"}</b></p>

            <div class="admin-booking-values">
                <span>Total: <b>${money(Number(item.price || 0))}</b></span>
                <span>Sinal: <b>${money(Number(item.deposit || 0))}</b></span>
            </div>

            <p class="admin-duration">Duração: ${item.durationText || item.duration || durationTextFromItem(item)}</p>

            <div class="admin-actions-row">
                ${phoneDigits ? `<button class="admin-whatsapp-btn" data-whatsapp="${waLink}">ABRIR WHATSAPP</button>` : ""}
                ${canCancel ? `<button class="admin-cancel-btn" data-id="${item.id}">CANCELAR</button>` : ""}
                ${isStatus(item, "expired") || isStatus(item, "cancelled") ? `<button class="admin-reactivate-btn" data-id="${item.id}">REATIVAR</button>` : ""}
            </div>
        </section>
    `;
}

function durationTextFromItem(item){
    const service = services.find(s => s.id === item.serviceId || s.name === item.service);
    return service?.durationText || `${item.durationMinutes || 60}min`;
}

function updateAppointmentStatus(id, status){
    const nowIso = new Date().toISOString();
    const items = getStoredAppointments().map(item => {
        if(item.id === id){
            const updated = { ...item, status };
            if(status === "Confirmado"){
                updated.confirmedAt = nowIso;
                updated.paymentStatus = "paid_manual_admin";
            }
            if(status === "Cancelado"){
                updated.cancelledAt = nowIso;
                updated.paymentStatus = "cancelled_by_admin";
            }
            if(status === "Reserva temporária"){
                updated.expiresAt = new Date(Date.now() + PENDING_EXPIRE_MINUTES * 60 * 1000).toISOString();
                updated.paymentStatus = "waiting_payment";
                delete updated.expiredAt;
                delete updated.cancelledAt;
            }
            return updated;
        }
        return item;
    });

    saveStoredAppointments(items);
    renderAdmin();

    const patch = { status: statusToFirebase(status), admin_seen: false };
    if(status === "Confirmado"){
        patch.payment_status = "paid_manual_admin";
        patch.confirmed_at = new Date().toLocaleString("pt-BR");
    }
    if(status === "Cancelado"){
        patch.payment_status = "cancelled_by_admin";
        patch.cancelled_at = new Date().toLocaleString("pt-BR");
    }
    if(status === "Reserva temporária"){
        patch.payment_status = "waiting_payment";
        patch.expires_at = new Date(Date.now() + PENDING_EXPIRE_MINUTES * 60 * 1000).toLocaleString("pt-BR");
    }

    patchAppointmentFirebase(id, patch)
        .then(() => loadAppointmentsFromFirebase())
        .catch(error => console.warn("Erro atualizando status no Firebase:", error));
}


function showPrettyConfirm({ title, message, confirmText = "CONFIRMAR", cancelText = "CANCELAR", danger = false }){
    return new Promise(resolve => {
        let modal = document.getElementById("prettyConfirmModal");

        if(!modal){
            modal = document.createElement("div");
            modal.id = "prettyConfirmModal";
            modal.innerHTML = `
                <div class="pretty-confirm-box" role="dialog" aria-modal="true">
                    <div class="pretty-confirm-icon">⚠️</div>
                    <h2 id="prettyConfirmTitle"></h2>
                    <p id="prettyConfirmMessage"></p>
                    <div class="pretty-confirm-actions">
                        <button type="button" id="prettyConfirmCancel"></button>
                        <button type="button" id="prettyConfirmOk"></button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);

            const style = document.createElement("style");
            style.id = "prettyConfirmStyle";
            style.textContent = `
                #prettyConfirmModal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;padding:22px;background:rgba(0,0,0,.78);backdrop-filter:blur(10px)}
                #prettyConfirmModal.active{display:flex}
                .pretty-confirm-box{width:min(92vw,460px);border:1px solid rgba(255,105,180,.6);border-radius:30px;padding:28px 22px 22px;background:radial-gradient(circle at top,#3a0b23,#16000c 68%);box-shadow:0 24px 70px rgba(0,0,0,.65);color:#fff;text-align:center}
                .pretty-confirm-icon{width:70px;height:70px;margin:0 auto 13px;border-radius:999px;display:flex;align-items:center;justify-content:center;background:rgba(255,105,180,.16);border:1px solid rgba(255,105,180,.5);font-size:31px}
                .pretty-confirm-box h2{margin:0 0 10px;font-size:27px;line-height:1.12;color:#ff69b4;font-weight:900}
                .pretty-confirm-box p{margin:0 auto 22px;font-size:17px;line-height:1.45;color:#ead6df;max-width:370px;white-space:pre-line}
                .pretty-confirm-actions{display:grid;grid-template-columns:1fr 1fr;gap:12px}
                .pretty-confirm-actions button{min-height:54px;border-radius:18px;border:0;font-size:15px;font-weight:900;letter-spacing:.2px}
                #prettyConfirmCancel{background:#2a1020;color:#fff;border:1px solid rgba(255,255,255,.14)}
                #prettyConfirmOk{background:linear-gradient(135deg,#e45a9d,#9a1230);color:#fff;box-shadow:0 12px 24px rgba(228,90,157,.2)}
                #prettyConfirmModal.danger #prettyConfirmOk{background:linear-gradient(135deg,#c1123c,#6e0921)}
            `;
            document.head.appendChild(style);
        }

        document.getElementById("prettyConfirmTitle").textContent = title || "Confirmar ação";
        document.getElementById("prettyConfirmMessage").textContent = message || "Deseja continuar?";
        const cancelBtn = document.getElementById("prettyConfirmCancel");
        const okBtn = document.getElementById("prettyConfirmOk");
        cancelBtn.textContent = cancelText;
        okBtn.textContent = confirmText;
        modal.classList.toggle("danger", !!danger);
        modal.classList.add("active");

        const cleanup = (answer) => {
            modal.classList.remove("active");
            cancelBtn.onclick = null;
            okBtn.onclick = null;
            modal.onclick = null;
            resolve(answer);
        };

        cancelBtn.onclick = () => cleanup(false);
        okBtn.onclick = () => cleanup(true);
        modal.onclick = (event) => { if(event.target === modal) cleanup(false); };
    });
}

function setupAdminCleanupButton(count){
    const list = document.getElementById("adminBookingsList");
    if(!list) return;

    let button = document.getElementById("btnCleanOldAppointments");
    if(!button){
        button = document.createElement("button");
        button.id = "btnCleanOldAppointments";
        button.type = "button";
        button.style.width = "100%";
        button.style.minHeight = "54px";
        button.style.margin = "14px 0 18px";
        button.style.border = "1px solid rgba(255, 105, 180, .45)";
        button.style.borderRadius = "18px";
        button.style.background = "rgba(255, 105, 180, .12)";
        button.style.color = "#fff";
        button.style.fontWeight = "900";
        button.style.fontSize = "15px";
        button.style.letterSpacing = ".2px";
        button.addEventListener("click", cleanOldAppointments);
        list.parentNode.insertBefore(button, list);
    }

    button.textContent = count > 0
        ? `LIMPAR EXPIRADOS/CANCELADOS (${count})`
        : "NENHUM EXPIRADO/CANCELADO PARA LIMPAR";
    button.disabled = count <= 0;
    button.style.opacity = count > 0 ? "1" : ".55";
}

async function cleanOldAppointments(){
    const items = getStoredAppointments();
    const removable = items.filter(item => isStatus(item, "expired") || isStatus(item, "cancelled"));

    if(removable.length === 0){
        showToast("Nada para limpar.");
        return;
    }

    const ok = await showPrettyConfirm({
        title: "Limpar histórico?",
        message: `Você vai limpar ${removable.length} agendamento(s) expirado(s)/cancelado(s).\n\nConfirmados e reservas temporárias serão mantidos com segurança.`,
        confirmText: "SIM, LIMPAR",
        cancelText: "VOLTAR",
        danger: true
    });
    if(!ok) return;

    const ids = removable.map(item => item.id).filter(Boolean);
    const remaining = items.filter(item => !ids.includes(item.id));

    saveStoredAppointments(remaining);
    renderAdmin();
    showToast("Limpando registros antigos...");

    try{
        await Promise.allSettled(ids.map(id => deleteAppointmentFirebase(id)));
        await fetchAppointmentsFromFirebase();
        renderAdmin();
        showToast("Expirados e cancelados limpos com sucesso ✓");
    }catch(error){
        console.warn("Erro limpando agendamentos antigos:", error);
        showToast("Limpei no aparelho, mas houve falha ao atualizar a nuvem.", "error");
    }
}



function ensureFinanceTotalCard(){
    const grid = document.querySelector('.admin-money-grid');
    if(!grid) return;

    // Renomeia 7 dias para Semana, do jeito que fica mais claro para a Lívia.
    const weekLabel = document.querySelector('#adminMoneyWeek')?.previousElementSibling;
    if(weekLabel) weekLabel.textContent = 'Semana';

    if(!document.getElementById('adminMoneyTotal')){
        const totalCard = document.createElement('div');
        totalCard.className = 'admin-money-total-card';
        totalCard.innerHTML = '<span>Total geral</span><strong id="adminMoneyTotal">R$ 0,00</strong>';
        grid.appendChild(totalCard);
    }

    if(!document.getElementById('financeRefineStyle')){
        const style = document.createElement('style');
        style.id = 'financeRefineStyle';
        style.textContent = `
            .admin-money-grid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important}
            .admin-money-grid > div{min-height:78px!important;display:flex!important;flex-direction:column!important;justify-content:center!important;align-items:center!important;text-align:center!important;border-radius:20px!important}
            .admin-money-grid > div span{font-size:14px!important;opacity:.9!important;margin-bottom:6px!important}
            .admin-money-grid > div strong{font-size:20px!important;line-height:1.1!important;color:#fff!important}
            .admin-money-total-card{border:1px solid rgba(255,105,180,.28)!important;background:linear-gradient(135deg,rgba(228,90,157,.13),rgba(0,0,0,.72))!important}
            .admin-finance-detail{display:grid;gap:6px;margin-top:14px;font-size:15px;line-height:1.35;color:#ead6df}
            .admin-finance-detail b{color:#ff69b4}
        `;
        document.head.appendChild(style);
    }
}

function updateFinanceDetailLine({confirmed, temp, expired, cancelled, confirmedTotal, tempTotal}){
    const line = document.getElementById('adminFinanceLine');
    if(!line) return;
    line.classList.add('admin-finance-detail');
    line.innerHTML = `
        <span><b>${confirmed.length}</b> confirmado(s) • <b>${money(confirmedTotal)}</b> recebidos</span>
        <span><b>${temp.length}</b> temporária(s) • <b>${money(tempTotal)}</b> aguardando</span>
        <span><b>${expired.length}</b> expirado(s) • <b>${cancelled.length}</b> cancelado(s)</span>
    `;
}

function renderAdmin(){
    const items = getStoredAppointments();
    const today = new Date();
    ensureFinanceTotalCard();

    const active = items.filter(item => isStatus(item, "confirmed") || isStatus(item, "temporary"));
    const temp = items.filter(item => isStatus(item, "temporary"));
    const confirmed = items.filter(item => isStatus(item, "confirmed"));
    const cancelled = items.filter(item => isStatus(item, "cancelled"));
    const expired = items.filter(item => isStatus(item, "expired"));

    document.getElementById("adminActiveCount").textContent = active.length;
    document.getElementById("adminTempCount").textContent = temp.length;
    document.getElementById("adminCanceledCount").textContent = cancelled.length;
    document.getElementById("adminConfirmedCount").textContent = confirmed.length;
    document.getElementById("adminSummaryTempCount").textContent = temp.length;
    document.getElementById("adminExpiredCount").textContent = expired.length;
    document.getElementById("adminSummaryCanceledCount").textContent = cancelled.length;

    setupAdminCleanupButton(expired.length + cancelled.length);

    const confirmedToday = confirmed.filter(item => isSameBRDate(item.date, today));
    const confirmedWeek = confirmed.filter(item => isWithinNextDays(item.date, 7));
    const confirmedMonth = confirmed.filter(item => currentMonthMatch(item.date));

    const sumDeposits = arr => arr.reduce((acc,item) => acc + Number(item.deposit || 0), 0);
    const totalConfirmedDeposits = sumDeposits(confirmed);
    const totalTempDeposits = sumDeposits(temp);

    document.getElementById("adminMoneyToday").textContent = money(sumDeposits(confirmedToday));
    document.getElementById("adminMoneyWeek").textContent = money(sumDeposits(confirmedWeek));
    document.getElementById("adminMoneyMonth").textContent = money(sumDeposits(confirmedMonth));
    const totalMoneyEl = document.getElementById("adminMoneyTotal");
    if(totalMoneyEl) totalMoneyEl.textContent = money(totalConfirmedDeposits);

    updateFinanceDetailLine({
        confirmed,
        temp,
        expired,
        cancelled,
        confirmedTotal: totalConfirmedDeposits,
        tempTotal: totalTempDeposits
    });

    document.getElementById("adminSignalsLine").textContent =
        `Sinais confirmados: ${money(sumDeposits(confirmed))} | Sinais temporários: ${money(sumDeposits(temp))}`;

    const todayItems = sortAppointments(active.filter(item => isSameBRDate(item.date, today)));
    document.getElementById("adminTodayLine").textContent =
        `${formatDateBR(today)} • ${todayItems.length} atendimento(s) • ${money(sumDeposits(todayItems.filter(i => isStatus(i, "confirmed"))))} confirmados`;

    const todayList = document.getElementById("adminTodayList");
    if(todayItems.length === 0){
        todayList.innerHTML = `<p class="admin-empty">Nenhum atendimento marcado para hoje.</p>`;
    }else{
        todayList.innerHTML = todayItems.map(item => `
            <div class="admin-today-item">
                <strong>${item.time}</strong>
                <span>${item.clientName || "Cliente"} • ${item.service}</span>
                <em>${item.status}</em>
            </div>
        `).join("");
    }

    let filtered = items;
    if(adminFilter !== "all"){
        filtered = items.filter(item => isStatus(item, adminFilter));
    }

    const list = document.getElementById("adminBookingsList");
    if(filtered.length === 0){
        list.innerHTML = `<p class="admin-empty">Nenhum agendamento encontrado.</p>`;
    }else{
        list.innerHTML = sortAppointments(filtered).map(adminBookingCard).join("");
    }

    list.querySelectorAll(".admin-whatsapp-btn").forEach(btn => {
        btn.addEventListener("click", () => window.open(btn.dataset.whatsapp, "_blank"));
    });
    list.querySelectorAll(".admin-cancel-btn").forEach(btn => {
        btn.addEventListener("click", () => updateAppointmentStatus(btn.dataset.id, "Cancelado"));
    });
    list.querySelectorAll(".admin-reactivate-btn").forEach(btn => {
        btn.addEventListener("click", () => updateAppointmentStatus(btn.dataset.id, "Reserva temporária"));
    });
}

function openAdminPanel(){
    renderAdmin();
    showScreen("admin");
}

function openAdminLoginModal(){
    const modal = document.getElementById("adminLoginModal");
    const input = document.getElementById("adminPasswordInput");
    modal.classList.add("active");
    input.value = "";
    setTimeout(() => input.focus(), 120);
}

function closeAdminLoginModal(){
    document.getElementById("adminLoginModal").classList.remove("active");
}

function confirmAdminLogin(){
    const input = document.getElementById("adminPasswordInput");
    if(input.value === "livia123"){
        closeAdminLoginModal();
        openAdminPanel();
    }else{
        input.value = "";
        input.placeholder = "Senha incorreta";
        input.classList.add("wrong");
        setTimeout(() => input.classList.remove("wrong"), 900);
    }
}

function setupHiddenAdminAccess(){
    const logo = document.querySelector(".logo");
    if(!logo) return;

    logo.addEventListener("click", () => {
        logoTapCount++;
        clearTimeout(logoTapTimer);
        logoTapTimer = setTimeout(() => logoTapCount = 0, 1200);

        if(logoTapCount >= 5){
            logoTapCount = 0;
            openAdminLoginModal();
        }
    });
}

/* Fotos admin em localStorage */
function getAdminPhotos(){
    try{
        const data = JSON.parse(localStorage.getItem("livia_extra_photos") || "[]");
        return Array.isArray(data) ? data : [];
    }catch(error){
        return [];
    }
}

function saveAdminPhotos(items){
    localStorage.setItem("livia_extra_photos", JSON.stringify(items));
}

function renderAdminPhotos(){
    const list = document.getElementById("adminPhotosList");
    const photos = getAdminPhotos();

    if(photos.length === 0){
        list.innerHTML = `
            <section class="admin-photo-empty">
                Nenhuma foto extra cadastrada.<br>
                As 3 fotos padrão continuam aparecendo na tela inicial.
            </section>
        `;
        return;
    }

    list.innerHTML = photos.map((src, index) => `
        <section class="admin-photo-card">
            <img src="${src}" alt="Foto cadastrada ${index + 1}">
            <button data-index="${index}" class="admin-delete-photo">EXCLUIR</button>
        </section>
    `).join("");

    list.querySelectorAll(".admin-delete-photo").forEach(btn => {
        btn.addEventListener("click", () => {
            const index = Number(btn.dataset.index);
            const updated = getAdminPhotos().filter((_, i) => i !== index);
            saveAdminPhotos(updated);
            renderAdminPhotos();
            renderHomeWorks();
        });
    });
}

function compressAdminPhoto(file, maxSize = 900, quality = 0.72){
    return new Promise(resolve => {
        if(!file){
            resolve(null);
            return;
        }

        const reader = new FileReader();

        reader.onload = () => {
            const img = new Image();

            img.onload = () => {
                try{
                    let width = img.width;
                    let height = img.height;

                    if(width > height && width > maxSize){
                        height = Math.round(height * (maxSize / width));
                        width = maxSize;
                    }else if(height >= width && height > maxSize){
                        width = Math.round(width * (maxSize / height));
                        height = maxSize;
                    }

                    const canvas = document.createElement("canvas");
                    canvas.width = width;
                    canvas.height = height;

                    const ctx = canvas.getContext("2d");
                    ctx.drawImage(img, 0, 0, width, height);

                    resolve(canvas.toDataURL("image/jpeg", quality));
                }catch(error){
                    console.warn("Erro compactando foto, usando original:", error);
                    resolve(reader.result);
                }
            };

            img.onerror = () => resolve(reader.result);
            img.src = reader.result;
        };

        reader.onerror = () => resolve(null);
        reader.readAsDataURL(file);
    });
}

function saveAdminPhotosSafe(items){
    try{
        saveAdminPhotos(items);
        return true;
    }catch(error){
        console.warn("Erro salvando fotos:", error);
        showToast("A memória do navegador encheu. Exclua algumas fotos antigas.", "error");
        return false;
    }
}

function addAdminPhoto(file, skipRender = false){
    if(!file) return Promise.resolve(false);

    return new Promise(async resolve => {
        try{
            const compressed = await compressAdminPhoto(file);
            if(!compressed){
                resolve(false);
                return;
            }

            const photos = getAdminPhotos();
            photos.unshift(compressed);

            const saved = saveAdminPhotosSafe(photos.slice(0, 50));
            if(!saved){
                resolve(false);
                return;
            }

            if(!skipRender){
                renderAdminPhotos();
                renderHomeWorks();
            }

            resolve(true);
        }catch(error){
            console.warn("Erro adicionando foto:", error);
            showToast("Não consegui adicionar essa foto.", "error");
            resolve(false);
        }
    });
}

async function addAdminPhotos(files){
    const selected = Array.from(files || []).filter(file => file && String(file.type || "").startsWith("image/"));

    if(selected.length === 0){
        showToast("Nenhuma foto selecionada.", "error");
        return;
    }

    let added = 0;

    for(const file of selected){
        const ok = await addAdminPhoto(file, true);
        if(ok) added++;
    }

    renderAdminPhotos();
    renderHomeWorks();

    const total = getAdminPhotos().length;

    if(added > 0){
        showToast(`${added} foto(s) adicionada(s). Total: ${total}`);
    }else{
        showToast("Nenhuma foto foi adicionada.", "error");
    }
}



function setupInfiniteWorksCarousel(){
    const grid = document.querySelector(".works-grid");
    if(!grid) return;

    let ticking = false;

    grid.addEventListener("scroll", () => {
        if(ticking) return;
        ticking = true;

        requestAnimationFrame(() => {
            const total = grid.scrollWidth;
            const third = total / 3;

            if(third > 0){
                if(grid.scrollLeft < third * 0.45){
                    grid.scrollLeft += third;
                }else if(grid.scrollLeft > third * 1.55){
                    grid.scrollLeft -= third;
                }
            }

            ticking = false;
        });
    });
}

renderServices();
renderHomeWorks();
startAppointmentsRealtime();
setupInfiniteWorksCarousel();
setupHiddenAdminAccess();
bindRealPixButton();

document.getElementById("btnAdminBackHome").addEventListener("click", () => showScreen("home"));
document.getElementById("btnAdminPhotos").addEventListener("click", () => { renderAdminPhotos(); showScreen("adminPhotos"); });
document.getElementById("btnBackAdminFromPhotos").addEventListener("click", () => { renderAdmin(); showScreen("admin"); });
const btnAddAdminPhoto = document.getElementById("btnAddAdminPhoto");
const adminPhotoInput = document.getElementById("adminPhotoInput");

if(btnAddAdminPhoto && adminPhotoInput){
    adminPhotoInput.setAttribute("multiple", "multiple");
    adminPhotoInput.multiple = true;
    adminPhotoInput.accept = "image/*";

    btnAddAdminPhoto.addEventListener("click", () => {
        adminPhotoInput.click();
    });

    adminPhotoInput.addEventListener("change", async event => {
        await addAdminPhotos(event.target.files);
        event.target.value = "";
    });
}

document.getElementById("btnAdminLoginCancel").addEventListener("click", closeAdminLoginModal);
document.getElementById("btnAdminLoginConfirm").addEventListener("click", confirmAdminLogin);
document.getElementById("adminPasswordInput").addEventListener("keydown", event => {
    if(event.key === "Enter") confirmAdminLogin();
});
document.getElementById("adminLoginModal").addEventListener("click", event => {
    if(event.target.id === "adminLoginModal") closeAdminLoginModal();
});

document.querySelectorAll(".admin-filter").forEach(button => {
    button.addEventListener("click", () => {
        document.querySelectorAll(".admin-filter").forEach(btn => btn.classList.remove("active"));
        button.classList.add("active");
        adminFilter = button.dataset.adminFilter;
        renderAdmin();
    });
});



async function generatePixAndReserveReal(){
    try{
        showLoading("Gerando Pix seguro...", "Aguarde alguns segundos. Não feche o aplicativo.");

        const booking = createTemporaryAppointment();
        if(!booking || !booking.id){
            hideLoading();
            alert("Não consegui criar a reserva temporária.");
            return;
        }

        const payData = await createAsaasPaymentForBooking(booking);

        const realPixPayload = payData.pix_payload || payData.pixPayload || "";
        const encodedImage = payData.encoded_image || payData.encodedImage || payData.qr_code || payData.qrCode || "";
        const invoiceUrl = payData.invoice_url || payData.invoiceUrl || "";
        const paymentId = payData.payment_id || payData.paymentId || "";

        if(!realPixPayload){
            await patchAppointmentFirebase(booking.id, {
                status: "expirado",
                payment_status: "asaas_no_pix_payload",
                payment_error: "Asaas criou cobrança, mas não retornou Pix copia e cola.",
                expired_at: new Date().toLocaleString("pt-BR")
            });
            hideLoading();
            alert("O Pix foi criado, mas o servidor não retornou o Pix copia e cola. Tente novamente.");
            return;
        }

        const updated = {
            ...booking,
            pixPayload: realPixPayload,
            asaasPaymentId: paymentId,
            invoiceUrl,
            paymentStatus: "waiting_payment"
        };

        const items = getStoredAppointments().map(item => item.id === booking.id ? updated : item);
        saveStoredAppointments(items);

        await patchAppointmentFirebase(booking.id, {
            pix_payload: realPixPayload,
            asaas_payment_id: paymentId,
            asaas_invoice_url: invoiceUrl,
            payment_status: "waiting_payment",
            payment_mode: payData.mode || "asaas"
        });

        currentBookingId = booking.id;
        clientData.pixPayload = realPixPayload;
        clientData.encodedImage = encodedImage;
        clientData.invoiceUrl = invoiceUrl;

        fillPix();
        pixPayload = realPixPayload;
        setPixQRCode(realPixPayload, encodedImage);
        hideLoading();
        showScreen("pix");
        startPixCountdown();
        loadAppointmentsFromFirebase();

    }catch(error){
        hideLoading();
        console.error("Erro Pix real:", error);
        alert(`Não consegui gerar o Pix pelo Asaas.\n\nDetalhe: ${error.message || error}`);
    }
}

function showLoading(title, message){
    const modal = document.getElementById("loadingModal");
    if(!modal) return;
    const titleEl = modal.querySelector("strong") || modal.querySelector("h2") || modal.querySelector(".loading-title");
    const msgEl = modal.querySelector("p") || modal.querySelector(".loading-message");
    if(titleEl) titleEl.textContent = title || "Processando...";
    if(msgEl) msgEl.textContent = message || "Aguarde alguns segundos.";
    modal.classList.add("active");
}

function hideLoading(){
    const modal = document.getElementById("loadingModal");
    if(modal) modal.classList.remove("active");
}

function bindRealPixButton(){
    const candidates = [
        "btnGeneratePix",
        "btnReserve",
        "btnConfirmReserve",
        "btnCreatePix",
        "btnSummaryPix"
    ];

    for(const id of candidates){
        const btn = document.getElementById(id);
        if(btn && !btn.dataset.realPixBound){
            btn.dataset.realPixBound = "1";
            btn.addEventListener("click", event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                generatePixAndReserveReal();
            }, true);
        }
    }

    document.querySelectorAll("button").forEach(btn => {
        const txt = (btn.textContent || "").trim().toUpperCase();
        if(txt.includes("GERAR PIX") && !btn.dataset.realPixBound){
            btn.dataset.realPixBound = "1";
            btn.addEventListener("click", event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                generatePixAndReserveReal();
            }, true);
        }
    });
}


console.log("Studio Lívia Rodrigues iniciado com Firebase real de agendamentos.");


document.getElementById("btnCancelNo").addEventListener("click", closeCancelModal);
document.getElementById("btnCancelYes").addEventListener("click", confirmCancelAppointment);
document.getElementById("cancelModal").addEventListener("click", (event) => {
    if(event.target.id === "cancelModal") closeCancelModal();
});



(function injectV33PolishStyles(){
    if(document.getElementById("borago_livia_v33_polish_styles")) return;
    const style = document.createElement("style");
    style.id = "borago_livia_v33_polish_styles";
    style.textContent = `
/* v33 polish: esconder contadores duplicados do topo do painel */
.adminTopStats,
.admin-top-stats,
.adminStatsTop,
.admin-stats-top,
.admin-kpis-top,
.top-admin-kpis,
#adminTopStats,
#adminStatsTop,
#adminQuickStats {
    display: none !important;
}

/* polimento mobile geral */
.admin-card, .appointment-card, .card, .finance-card {
    box-sizing: border-box;
}

#adminScreen .section-card,
#adminScreen .panel-card,
#adminScreen .admin-section {
    margin-top: 18px;
}

#adminScreen h1,
#adminScreen h2,
#adminScreen h3 {
    letter-spacing: -0.02em;
}

#adminScreen .finance-grid,
#adminScreen .summary-grid {
    gap: 12px;
}

#adminScreen button,
#pixScreen button,
#myAppointmentsScreen button {
    min-height: 54px;
}

/* QR e Pix: alinhamento mais firme sem aumentar demais */
.pix-payment-card,
.pix-card,
.pix-box,
#pixScreen .pix-row {
    align-items: center !important;
}

#pixScreen canvas,
#pixScreen img.qr,
#pixQrImage,
#pixQrCode {
    display: block !important;
    margin: 0 auto !important;
}

/* botões com respiro */
.clean-history-btn,
.clear-history-btn,
#btnCleanHistory,
#btnClearHistory,
#clearOldAppointmentsBtn {
    margin-top: 14px !important;
}
`;
    document.head.appendChild(style);
})();




function hideDuplicateAdminTopCountersV33(){
    const admin = document.getElementById("adminScreen");
    if(!admin) return;

    const candidates = Array.from(admin.querySelectorAll("div, section"));
    for(const el of candidates){
        const txt = (el.innerText || "").replace(/\s+/g, " ").trim().toLowerCase();
        const hasTopCounters =
            txt.includes("ativos") &&
            txt.includes("temporárias") &&
            txt.includes("cancelados") &&
            !txt.includes("resumo administrativo") &&
            !txt.includes("financeiro") &&
            !txt.includes("todos os agendamentos");

        if(hasTopCounters){
            const rect = el.getBoundingClientRect();
            if(rect.height > 30 && rect.height < 220){
                el.style.display = "none";
                el.setAttribute("data-hidden-v33", "duplicate-admin-counters");
                break;
            }
        }
    }
}

setInterval(hideDuplicateAdminTopCountersV33, 800);
document.addEventListener("DOMContentLoaded", hideDuplicateAdminTopCountersV33);




/* ===== V37 AJUSTES FINAIS SEGUROS ===== */

(function injectLiviaV37FinalStyles(){
    const styleId = "livia_v37_final_styles";
    if(document.getElementById(styleId)) return;

    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
        /* QR: puxar para dentro do quadrinho branco */
        #pixScreen .qr-card{
            padding-left: 18px !important;
            padding-right: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            overflow: visible !important;
        }

        #pixScreen #pixQrBox,
        #pixScreen .pix-real-qr-box{
            width: 156px !important;
            height: 156px !important;
            min-width: 156px !important;
            min-height: 156px !important;
            background: #fff !important;
            border-radius: 18px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 10px !important;
            box-sizing: border-box !important;
            overflow: hidden !important;
            transform: translateX(18px) !important;
        }

        #pixScreen #pixQrImg{
            width: 132px !important;
            height: 132px !important;
            max-width: 132px !important;
            max-height: 132px !important;
            object-fit: contain !important;
            display: block !important;
            margin: auto !important;
            position: static !important;
            transform: none !important;
        }

        /* Inputs: tira esse azul clarinho feio quando clica/digita */
        input,
        textarea,
        select {
            background: #fff5fa !important;
            color: #111 !important;
            caret-color: #e65ca2 !important;
            outline: none !important;
            box-shadow: none !important;
            -webkit-tap-highlight-color: transparent !important;
        }

        input:focus,
        textarea:focus,
        select:focus {
            background: #fff5fa !important;
            color: #111 !important;
            border: 2px solid #e65ca2 !important;
            outline: none !important;
            box-shadow: 0 0 0 3px rgba(230,92,162,.18) !important;
        }

        input::selection,
        textarea::selection {
            background: rgba(230,92,162,.35) !important;
            color: #111 !important;
        }

        /* Modal bonito para avisos */
        .livia-alert-overlay{
            position: fixed;
            inset: 0;
            z-index: 999999;
            background: rgba(0,0,0,.72);
            backdrop-filter: blur(5px);
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 22px;
        }

        .livia-alert-card{
            width: min(92vw, 520px);
            background: linear-gradient(160deg, #260717, #120008);
            border: 1px solid rgba(230,92,162,.55);
            border-radius: 30px;
            padding: 30px 22px 24px;
            text-align: center;
            color: #fff;
            box-shadow: 0 22px 60px rgba(0,0,0,.65);
        }

        .livia-alert-icon{
            width: 74px;
            height: 74px;
            margin: 0 auto 16px;
            border-radius: 999px;
            background: rgba(230,92,162,.16);
            border: 1px solid rgba(230,92,162,.55);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 38px;
        }

        .livia-alert-title{
            font-size: 30px;
            font-weight: 900;
            color: #ff65ad;
            margin-bottom: 12px;
            line-height: 1.12;
        }

        .livia-alert-message{
            font-size: 20px;
            line-height: 1.35;
            color: rgba(255,255,255,.86);
            white-space: pre-line;
            margin-bottom: 24px;
        }

        .livia-alert-button{
            width: 100%;
            min-height: 58px;
            border: 0;
            border-radius: 18px;
            background: #e65ca2;
            color: #080004;
            font-size: 19px;
            font-weight: 900;
            text-transform: uppercase;
        }
    `;
    document.head.appendChild(style);
})();

function liviaPrettyAlertV37(message, title = "Atenção"){
    const old = document.querySelector(".livia-alert-overlay");
    if(old) old.remove();

    const overlay = document.createElement("div");
    overlay.className = "livia-alert-overlay";
    overlay.innerHTML = `
        <div class="livia-alert-card">
            <div class="livia-alert-icon">⚠️</div>
            <div class="livia-alert-title">${title}</div>
            <div class="livia-alert-message">${String(message || "").replace(/</g, "&lt;")}</div>
            <button class="livia-alert-button" type="button">OK</button>
        </div>
    `;

    overlay.querySelector("button").onclick = () => overlay.remove();
    overlay.addEventListener("click", (ev) => {
        if(ev.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
}

(function replaceNativeAlertV37(){
    if(window.__liviaAlertV37Installed) return;
    window.__liviaAlertV37Installed = true;
    window.alert = function(message){
        liviaPrettyAlertV37(message, "Atenção");
    };
})();

function forcePixQrInsideV37(){
    const box = document.getElementById("pixQrBox");
    const img = document.getElementById("pixQrImg");

    if(box){
        box.style.transform = "translateX(18px)";
        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.justifyContent = "center";
        box.style.overflow = "hidden";
        box.style.padding = "10px";
    }

    if(img){
        img.style.width = "132px";
        img.style.height = "132px";
        img.style.maxWidth = "132px";
        img.style.maxHeight = "132px";
        img.style.objectFit = "contain";
        img.style.margin = "auto";
        img.style.position = "static";
        img.style.transform = "none";
    }
}

setInterval(forcePixQrInsideV37, 500);
document.addEventListener("DOMContentLoaded", forcePixQrInsideV37);




/* ===== V38 QR: manter quadrinho no lugar e centralizar só o QR dentro dele ===== */
(function injectLiviaV38QrFix(){
    const styleId = "livia_v38_qr_only_fix";
    if(!document.getElementById(styleId)){
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            #pixScreen .qr-card{
                padding-left: 0 !important;
                padding-right: 0 !important;
                transform: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: visible !important;
            }

            #pixScreen #pixQrBox,
            #pixScreen .pix-real-qr-box{
                transform: none !important;
                margin: 0 auto !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 10px !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
            }

            #pixScreen #pixQrImg{
                width: 132px !important;
                height: 132px !important;
                max-width: 132px !important;
                max-height: 132px !important;
                object-fit: contain !important;
                display: block !important;
                margin: auto !important;
                position: relative !important;
                left: 0 !important;
                right: 0 !important;
                top: 0 !important;
                transform: translateX(8px) !important;
            }
        `;
        document.head.appendChild(style);
    }
})();

function forcePixQrOnlyInsideV38(){
    const card = document.querySelector("#pixScreen .qr-card");
    const box = document.getElementById("pixQrBox");
    const img = document.getElementById("pixQrImg");

    if(card){
        card.style.paddingLeft = "0";
        card.style.paddingRight = "0";
        card.style.transform = "none";
        card.style.display = "flex";
        card.style.alignItems = "center";
        card.style.justifyContent = "center";
    }

    if(box){
        box.style.transform = "none";
        box.style.margin = "0 auto";
        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.justifyContent = "center";
        box.style.padding = "10px";
        box.style.overflow = "hidden";
    }

    if(img){
        img.style.width = "132px";
        img.style.height = "132px";
        img.style.maxWidth = "132px";
        img.style.maxHeight = "132px";
        img.style.objectFit = "contain";
        img.style.display = "block";
        img.style.margin = "auto";
        img.style.position = "relative";
        img.style.left = "0";
        img.style.right = "0";
        img.style.top = "0";
        img.style.transform = "translateX(8px)";
    }
}

setInterval(forcePixQrOnlyInsideV38, 400);
document.addEventListener("DOMContentLoaded", forcePixQrOnlyInsideV38);




/* ===== V39 PIX CARD: layout igual referência, sem QR invadir texto ===== */
(function injectLiviaV39PixCardFix(){
    const styleId = "livia_v39_pix_card_fix";
    if(!document.getElementById(styleId)){
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            /* Card inteiro: 2 colunas fixas igual referência */
            #pixScreen .pix-compact-row{
                display: grid !important;
                grid-template-columns: 172px minmax(0, 1fr) !important;
                column-gap: 18px !important;
                align-items: center !important;
                overflow: hidden !important;
                padding: 14px 18px 14px 14px !important;
                box-sizing: border-box !important;
            }

            /* Coluna do QR parada, sem empurrar o texto */
            #pixScreen .qr-card{
                width: 172px !important;
                min-width: 172px !important;
                max-width: 172px !important;
                height: 172px !important;
                padding: 0 !important;
                margin: 0 !important;
                transform: none !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                overflow: visible !important;
                box-sizing: border-box !important;
                grid-column: 1 !important;
            }

            /* Quadrinho branco fixo */
            #pixScreen #pixQrBox,
            #pixScreen .pix-real-qr-box{
                width: 156px !important;
                min-width: 156px !important;
                max-width: 156px !important;
                height: 156px !important;
                min-height: 156px !important;
                max-height: 156px !important;
                background: #fff !important;
                border-radius: 18px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                padding: 10px !important;
                margin: 0 auto !important;
                transform: none !important;
                position: relative !important;
                left: auto !important;
                right: auto !important;
                overflow: hidden !important;
                box-sizing: border-box !important;
                flex: 0 0 156px !important;
            }

            /* QR centralizado dentro do quadrinho */
            #pixScreen #pixQrImg{
                width: 132px !important;
                min-width: 132px !important;
                max-width: 132px !important;
                height: 132px !important;
                min-height: 132px !important;
                max-height: 132px !important;
                object-fit: contain !important;
                display: block !important;
                margin: auto !important;
                padding: 0 !important;
                transform: none !important;
                position: static !important;
                left: auto !important;
                right: auto !important;
                top: auto !important;
                bottom: auto !important;
            }

            /* Área do texto começa depois do QR, nunca por baixo dele */
            #pixScreen .pix-safe-card{
                grid-column: 2 !important;
                min-width: 0 !important;
                width: 100% !important;
                padding: 0 !important;
                margin: 0 !important;
                transform: none !important;
                box-sizing: border-box !important;
                overflow: visible !important;
            }

            #pixScreen .pix-safe-card h3,
            #pixScreen .pix-safe-card p,
            #pixScreen .pix-safe-card button{
                position: relative !important;
                z-index: 2 !important;
            }

            #pixScreen .pix-safe-card button{
                width: 100% !important;
                max-width: 100% !important;
                margin-top: 12px !important;
            }
        `;
        document.head.appendChild(style);
    }
})();

function forcePixCardReferenceLayoutV39(){
    const row = document.querySelector("#pixScreen .pix-compact-row");
    const qrCard = document.querySelector("#pixScreen .qr-card");
    const box = document.getElementById("pixQrBox");
    const img = document.getElementById("pixQrImg");
    const safe = document.querySelector("#pixScreen .pix-safe-card");

    if(row){
        row.style.display = "grid";
        row.style.gridTemplateColumns = "172px minmax(0, 1fr)";
        row.style.columnGap = "18px";
        row.style.alignItems = "center";
        row.style.overflow = "hidden";
        row.style.padding = "14px 18px 14px 14px";
        row.style.boxSizing = "border-box";
    }

    if(qrCard){
        qrCard.style.width = "172px";
        qrCard.style.minWidth = "172px";
        qrCard.style.maxWidth = "172px";
        qrCard.style.height = "172px";
        qrCard.style.padding = "0";
        qrCard.style.margin = "0";
        qrCard.style.transform = "none";
        qrCard.style.display = "flex";
        qrCard.style.alignItems = "center";
        qrCard.style.justifyContent = "center";
        qrCard.style.gridColumn = "1";
    }

    if(box){
        box.style.width = "156px";
        box.style.minWidth = "156px";
        box.style.maxWidth = "156px";
        box.style.height = "156px";
        box.style.minHeight = "156px";
        box.style.maxHeight = "156px";
        box.style.padding = "10px";
        box.style.margin = "0 auto";
        box.style.transform = "none";
        box.style.position = "relative";
        box.style.left = "auto";
        box.style.right = "auto";
        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.justifyContent = "center";
        box.style.overflow = "hidden";
        box.style.boxSizing = "border-box";
    }

    if(img){
        img.style.width = "132px";
        img.style.minWidth = "132px";
        img.style.maxWidth = "132px";
        img.style.height = "132px";
        img.style.minHeight = "132px";
        img.style.maxHeight = "132px";
        img.style.margin = "auto";
        img.style.transform = "none";
        img.style.position = "static";
        img.style.objectFit = "contain";
        img.style.display = "block";
    }

    if(safe){
        safe.style.gridColumn = "2";
        safe.style.minWidth = "0";
        safe.style.width = "100%";
        safe.style.padding = "0";
        safe.style.margin = "0";
        safe.style.transform = "none";
        safe.style.overflow = "visible";
    }
}

setInterval(forcePixCardReferenceLayoutV39, 150);
document.addEventListener("DOMContentLoaded", forcePixCardReferenceLayoutV39);




/* ===== V40: NÃO mexer no quadrado branco, mover SOMENTE o desenho do QR ===== */
(function injectLiviaV40QrSymbolOnly(){
    const styleId = "livia_v40_qr_symbol_only";
    if(!document.getElementById(styleId)){
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
            /* mantém o quadrinho branco no lugar */
            #pixScreen #pixQrBox,
            #pixScreen .pix-real-qr-box{
                transform: none !important;
                left: auto !important;
                right: auto !important;
                top: auto !important;
                bottom: auto !important;
                margin: 0 auto !important;
                overflow: hidden !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                position: relative !important;
            }

            /* move só o símbolo/imagem do QR para o centro visual */
            #pixScreen #pixQrImg{
                position: relative !important;
                display: block !important;
                width: 132px !important;
                height: 132px !important;
                min-width: 132px !important;
                min-height: 132px !important;
                max-width: 132px !important;
                max-height: 132px !important;
                object-fit: contain !important;
                margin: auto !important;
                left: 0 !important;
                top: 0 !important;
                transform: translate(24px, 4px) !important;
            }
        `;
        document.head.appendChild(style);
    }
})();

function forceQrSymbolOnlyV40(){
    const box = document.getElementById("pixQrBox");
    const img = document.getElementById("pixQrImg");

    if(box){
        box.style.transform = "none";
        box.style.left = "auto";
        box.style.right = "auto";
        box.style.top = "auto";
        box.style.bottom = "auto";
        box.style.margin = "0 auto";
        box.style.overflow = "hidden";
        box.style.display = "flex";
        box.style.alignItems = "center";
        box.style.justifyContent = "center";
        box.style.position = "relative";
    }

    if(img){
        img.style.position = "relative";
        img.style.display = "block";
        img.style.width = "132px";
        img.style.height = "132px";
        img.style.minWidth = "132px";
        img.style.minHeight = "132px";
        img.style.maxWidth = "132px";
        img.style.maxHeight = "132px";
        img.style.objectFit = "contain";
        img.style.margin = "auto";
        img.style.left = "0";
        img.style.top = "0";
        img.style.transform = "translate(24px, 4px)";
    }
}

setInterval(forceQrSymbolOnlyV40, 200);
document.addEventListener("DOMContentLoaded", forceQrSymbolOnlyV40);

