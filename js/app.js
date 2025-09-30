var video = document.querySelector("#video");
var canvas = document.querySelector("#canvas");
var file = document.querySelector("#videofile");
var videoControls = document.querySelector("#videoControls");
var videow = document.querySelector("#videow");
var snap = document.querySelector("#snap");
var snap2 = document.querySelector("#snap2");
var save = document.querySelector("#save");
var saveall = document.querySelector("#saveall");
var clear = document.querySelector("#clear");
var videoInfo = document.querySelector("#videoInfo");
var snapSize = document.querySelector("#snapsize");
var context = canvas.getContext("2d", { willReadFrequently: true });
var slider = document.querySelector("#slider");
var w, h, ratio;
var snapProc = null;
var cancelRequested = false;
var isProcessing = false;

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
  if (!video || !video.duration) return;
  
  // Don't trigger if typing in an input
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
  
  switch(e.key) {
    case ' ':
      e.preventDefault();
      video.paused ? video.play() : video.pause();
      break;
    case 's':
    case 'S':
      e.preventDefault();
      if (!snap.disabled) snapPicture();
      break;
    case 'ArrowLeft':
      e.preventDefault();
      goToTime(video, video.currentTime - 1/30);
      break;
    case 'ArrowRight':
      e.preventDefault();
      goToTime(video, video.currentTime + 1/30);
      break;
  }
});

function timeUpdate() {
  slider.setAttribute("max", Math.ceil(video.duration));
  slider.value = video.currentTime;
  videoInfo.style.display = "block";
  videoInfo.innerHTML = [
    "Video size: " + video.videoWidth + "x" + video.videoHeight,
    "Video length: " + Math.round(video.duration * 10) / 10 + "sec",
    "Playback position: " + Math.round(video.currentTime * 10) / 10 + "sec",
  ].join("<br>");
}

function goToTime(video, time) {
  video.currentTime = Math.min(video.duration, Math.max(0, time));
  timeUpdate();
}

video.addEventListener("timeupdate", timeUpdate);

setInterval(function () {
  if (!video) return;
  if (video.paused){
    document.querySelector(".play-control").style.display = "block";
    document.querySelector(".pause-control").style.display = "none";
  } else {
    document.querySelector(".play-control").style.display = "none";
    document.querySelector(".pause-control").style.display = "block";
  }
}, 300);

video.addEventListener("loadedmetadata", function () {
  console.log("Metadata loaded");
  videow.value = video.videoWidth;
  videoInfo.innerHTML = [
    "Video size: " + video.videoWidth + "x" + video.videoHeight,
    "Video length: " + Math.round(video.duration * 10) / 10 + "sec",
  ].join("<br>");
  video.objectURL = false;
  video.play();
  video.pause();
  resize();
}, false);

function resize() {
  ratio = video.videoWidth / video.videoHeight;
  w = videow.value;
  h = parseInt(w / ratio, 10);
  canvas.width = w;
  canvas.height = h;
}

function snapPicture() {
  context.fillRect(0, 0, w, h);
  context.drawImage(video, 0, 0, w, h);
  var time = video.currentTime;

  const container = document.querySelector("#outputs");
  const img = document.createElement("img");
  img.src = canvas.toDataURL();
  img.className = "output";
  img.addEventListener("click", () => selectImage(img));
  img.title = "t" + ("000" + time.toFixed(2)).slice(-7) + 'seg';
  img.onclick = function(){ goToTime(video, time); };
  
  var cont = document.createElement("div");
  cont.className = "output-container";
  cont.style.display = "inline-block";
  cont.appendChild(img);
  
  var label = document.createElement("label");
  label.innerHTML = (time.toFixed(2)) + 's ' + w + "x" + h;
  cont.appendChild(label);

  var close = document.createElement("a");
  close.className = "output-remove";
  close.innerHTML = "×";
  close.addEventListener("click", function () {
    container.removeChild(cont);
    if (container.children.length == 0) {
      save.disabled = true;
      saveall.disabled = true;
      clear.disabled = true;
    }
  });
  cont.appendChild(close);
  
  container.appendChild(cont);
  img.setAttribute("size", w + "x" + h);
  selectImage(img);
}

function autoSnapPictureAfterSelection(){
  var sel = document.querySelector('#snap_each');
  var value = 0;
  if (sel.value.indexOf('%') > 0){
    value = sel.value.replace('%', '') * 1.0 / 100;
    autoSnapPictureOptimized(value, 'percent');
  }
  if (sel.value.indexOf('m') > 0){
    value = sel.value.replace('m', '') * 1.0;
    autoSnapPictureOptimized(value * 60, 'seconds');
  }
}

function showProgress(current, total) {
  const progressContainer = document.getElementById('progressContainer');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  
  progressContainer.style.display = 'block';
  const percentage = Math.round((current / total) * 100);
  progressBar.style.width = percentage + '%';
  progressText.textContent = `Processing: ${current} of ${total} frames (${percentage}%)`;
}

function hideProgress() {
  const progressContainer = document.getElementById('progressContainer');
  progressContainer.style.display = 'none';
}

function cancelAutoSnap() {
  cancelRequested = true;
  if (snapProc) {
    clearInterval(snapProc);
    snapProc = null;
  }
}

// Optimized batch processing - MUCH faster
async function autoSnapPictureOptimized(value, type) {
  if (!video.duration) {
    alert("Please load a video first");
    return;
  }
  
  if (isProcessing) {
    alert("Already processing. Please wait or cancel.");
    return;
  }
  
  cancelRequested = false;
  isProcessing = true;
  clearSnaps();
  
  var duration = video.duration;
  var times = [];
  var interval;
  
  // Calculate all timestamps
  if (type === 'percent') {
    interval = value * duration;
  } else {
    interval = value;
  }
  
  var time = 0.1;
  while (time < duration) {
    times.push(time);
    time += interval;
  }
  
  console.log(`Processing ${times.length} frames...`);
  
  // Disable buttons during processing
  snap2.disabled = true;
  snap.disabled = true;
  
  try {
    for (let i = 0; i < times.length; i++) {
      if (cancelRequested) {
        console.log('Processing cancelled by user');
        break;
      }
      
      showProgress(i + 1, times.length);
      
      // Seek and wait for video to be ready
      await seekAndCapture(times[i]);
      
      // Small delay to allow UI updates
      await sleep(10);
    }
  } catch (error) {
    console.error('Error during processing:', error);
    alert('Error during processing: ' + error.message);
  } finally {
    hideProgress();
    isProcessing = false;
    cancelRequested = false;
    snap2.disabled = false;
    snap.disabled = false;
  }
}

// Promise-based seeking for better control
function seekAndCapture(time) {
  return new Promise((resolve, reject) => {
    let seeked = false;
    
    const onSeeked = () => {
      if (seeked) return;
      seeked = true;
      video.removeEventListener('seeked', onSeeked);
      
      // Wait a bit for frame to be fully rendered
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            snapPicture();
            resolve();
          } catch (error) {
            reject(error);
          }
        });
      });
    };
    
    video.addEventListener('seeked', onSeeked);
    
    // Timeout fallback
    setTimeout(() => {
      if (!seeked) {
        video.removeEventListener('seeked', onSeeked);
        reject(new Error('Seek timeout'));
      }
    }, 2000);
    
    video.currentTime = time;
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function zipAllImages(){
  var zip = new JSZip();
  const container = document.querySelector("#outputs");
  var images = container.querySelectorAll("img");
  var imgFolder = zip.folder("images");
  images.forEach(function(img){
    var imgData = img.src.replace(/^data:image\/(png|jpg);base64,/, "");
    imgFolder.file(img.title + ".png", imgData, {base64: true});
  });
  zip.generateAsync({type:"blob"})
  .then(function(content) {
      saveAs(content, "images.zip");
  }); 
}

function clearSnaps(){
  const container = document.querySelector("#outputs");
  container.innerHTML = "";
  save.disabled = true;
  saveall.disabled = true;
  clear.disabled = true;
}

function selectImage(img) {
  var parent = img.parentElement.parentElement;
  var images = parent.querySelectorAll('.output-container > img');
  for (let index = 0; index < images.length; index++) {
    const element = images[index];
    if (element != img) {
      element.classList.remove("selected");
    }
  }
  img.classList.add("selected");

  var preview = document.querySelector("#preview");
  preview.src = img.src;
  preview.style.display = '';
  preview.title = img.title;
  save.disabled = false;
  saveall.disabled = false;
  clear.disabled = false;
}

function selectVideo() {
  file.click();
}

function loadVideoFile() {
  var fileInput = file.files[0];
  if (fileInput) {
    console.log("Loading...");
    if (video.objectURL && video.src) {
      URL.revokeObjectURL(video.src);
    }
    video.preload = "metadata";
    video.objectURL = true;
    video.src = URL.createObjectURL(fileInput);
    videow.removeAttribute("readonly");
    snap.disabled = false;
    snap2.disabled = false;
    videoControls.style.display = "";
  }
}

function loadVideoURL(url) {
  video.preload = "metadata";
  video.src = url;
  videow.removeAttribute("readonly");
  snap.disabled = false;
  snap2.disabled = false;
  videoControls.style.display = "";
}

function savePicture(btn) {
  var selected = document.querySelector(".selected");
  if (selected) {
    var dataURL = selected.src;
    var link = document.getElementById("imagelink");
    link.style.display = "";
    link.style.opacity = 0;
    link.href = dataURL;
    var rnd = Math.round(Math.random() * 10000);
    link.setAttribute("download", "video-capture-" + selected.title + "-" + rnd + ".png");
    link.click();
    setTimeout(function () {
      link.style.display = "none";
    }, 100);
  }
}

window.addEventListener("load", function () {
  var buttons = document.querySelectorAll("button");
  for (let index = 0; index < buttons.length; index++) {
    var element = buttons[index];
    element.addEventListener("click", function () {
      var name = this.innerText.trim();
      var category = "button";
      if (this.getAttribute("category") == "controls") {
        name = "Video Controls";
        category = "controls";
      }
      var id = name.toLowerCase().replace(" ", "_");
      if (typeof gtag !== 'undefined') {
        gtag("event", category + "-" + id, {});
      }
    });
  }
});
