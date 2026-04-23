const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const FILE = "./reports.json";

const load = () => {
    try { return JSON.parse(fs.readFileSync(FILE)); }
    catch { return []; }
};

const save = (data) => {
    fs.writeFileSync(FILE, JSON.stringify(data, null, 2));
};

let reports = load();

// 🔔 LONG POLLING
let listeners = [];

app.get("/events", (req, res) => {
    listeners.push(res);
});

function sendEvent(data){
    listeners.forEach(res => res.json(data));
    listeners = [];
}

// 📩 REPORT
app.post("/report", (req, res) => {
    const report = {
        id: Date.now(),
        reporter: req.body.reporter,
        reportedUser: req.body.reportedUser,
        reason: req.body.reason,
        status: "pending",
        handledBy: null,
        note: "",
        time: new Date().toLocaleString()
    };

    reports.unshift(report);
    save(reports);

    io.emit("new_report", report);
    res.sendStatus(200);
});

// 🔘 ACTION
app.post("/action", (req, res) => {
    const { id, action, note, admin } = req.body;

    const report = reports.find(r => r.id == id);
    if (!report) return res.sendStatus(404);

    report.status = action;
    report.note = note || "";
    report.handledBy = admin || "Dashboard";

    save(reports);
    io.emit("update_reports");

    sendEvent({
        type: "action",
        report
    });

    res.sendStatus(200);
});

app.get("/reports", (req, res) => res.json(reports));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log("Running on " + PORT));
