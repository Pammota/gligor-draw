var canvas = document.getElementById("canvas");
var ctx = canvas.getContext("2d");
var socket = new WebSocket(
  "wss://" + document.domain + ":" + location.port + "/ws"
);

var isDrawing = false;
var lines = [];
var currentLine = [];
var isAppClosing = false;
loadDrawing();

// Desktop
canvas.addEventListener("mousedown", startDrawing);
canvas.addEventListener("mouseup", stopDrawing);
canvas.addEventListener("mouseout", stopDrawing);
canvas.addEventListener("mousemove", draw);

// Mobile
canvas.addEventListener("touchend", stopDrawing);
canvas.addEventListener("touchcancel", stopDrawing);
canvas.addEventListener("touchstart", function (e) {
  e.preventDefault();
  var touch = e.touches[0];
  startDrawing(touch);
});
canvas.addEventListener("touchmove", function (e) {
  e.preventDefault();
  var touch = e.touches[0];
  draw(touch);
});

socket.onmessage = function (event) {
  // draw or clear whem message
  var data = JSON.parse(event.data);
  if (data.type === "draw") {
    lines.push({ points: data.content, color: data.color });
    redrawLines();

    saveDrawing();
  } else if (data.type === "clear") {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    lines = [];

    localStorage.removeItem("drawingData");
  }
};

socket.onclose = function (e) {
  if (!isAppClosing) {
    console.log(
      "Socket is closed. Reconnect will be attempted in 1 second.",
      e.reason
    );
    setTimeout(function () {
      connect();
    }, 1000);
  }
};

socket.onerror = function (err) {
  console.error(
    "Socket encountered error: ",
    err.message,
    "Closing socket"
  );
  socket.close();
};

function connect() {
  socket = new WebSocket(
    "wss://" + document.domain + ":" + location.port + "/ws"
  );
}

function draw(e) {
  if (!isDrawing) return;
  var x = e.pageX - canvas.offsetLeft;
  var y = e.pageY - canvas.offsetTop;
  // Draw the line segment from the last point to the new point
  var lastPoint = currentLine[currentLine.length - 1];
  ctx.beginPath();
  ctx.moveTo(lastPoint.x, lastPoint.y);
  ctx.lineTo(x, y);
  ctx.stroke();
  // Push the new point to currentLine
  currentLine.push({ x: x, y: y });

  socket.send(
    JSON.stringify({
      type: "draw",
      content: currentLine,
      color: document.getElementById("color").value,
    })
  );
}

function startDrawing(e) {
  isDrawing = true;
  currentLine = [];
  var x = e.pageX - canvas.offsetLeft;
  var y = e.pageY - canvas.offsetTop;
  currentLine.push({ x: x, y: y });
}

function stopDrawing() {
  isDrawing = false;
  lines.push({
    points: currentLine,
    color: document.getElementById("color").value,
  });
  currentLine = [];
}

function redrawLines() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  lines.forEach(function (line) {
    if (line.points && line.points.length > 1) {
      drawSmoothLine(line.points, line.color);
    }
  });
}
function drawSmoothLine(points, color) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  for (var i = 1; i < points.length; i++) {
    var point = points[i];
    ctx.lineTo(point.x, point.y);
  }
  ctx.stroke();
}

function saveDrawing() {
  localStorage.setItem("drawingData", JSON.stringify(lines));
}

function loadDrawing() {
  var drawingData = localStorage.getItem("drawingData");
  if (drawingData) {
    lines = JSON.parse(drawingData);

    redrawLines();
  }
}

function exportDrawing() {
  if (lines.length === 0) {
    console.log("No drawing to export.");
    return;
  }

  // Create a temporary canvas with a white background
  var tempCanvas = document.createElement("canvas");
  var tempCtx = tempCanvas.getContext("2d");
  tempCanvas.width = canvas.width;
  tempCanvas.height = canvas.height;
  tempCtx.fillStyle = "white";
  tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

  // Copy the drawing from the main canvas onto the temporary canvas
  tempCtx.drawImage(canvas, 0, 0);

  // Create a temporary link element
  var link = document.createElement("a");
  link.download = "drawing.jpg";
  link.href = tempCanvas.toDataURL("image/jpeg", 1); // Convert canvas to JPEG image
  link.click();
}

function deleteDrawing() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  localStorage.removeItem("drawingData");

  socket.send(JSON.stringify({ type: "clear" }));
}

document.getElementById("color").addEventListener("change", function () {
  localStorage.setItem("selectedColor", this.value);
});

var savedColor = localStorage.getItem("selectedColor");
if (savedColor) {
  document.getElementById("color").value = savedColor;
}

// PING mechanism
var pingInterval = setInterval(function () {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "ping" }));
  }
}, 60 * 1000); // 1 minute

// UNLOAD
window.addEventListener("beforeunload", function () {
  isAppClosing = true;
  clearInterval(pingInterval);
  socket.close();
});
