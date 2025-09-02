import { initViewer, loadModel } from './viewer.js';

const App = {
    viewer: null,
    urn: null,
    extensions: {}
};

initViewer(document.getElementById('preview')).then(viewer => {
    App.viewer = viewer;
    const urn = window.location.hash?.substring(1);
    setupModelSelection(viewer, urn);
    setupModelUpload(viewer);
    setupDashboard(viewer);
    viewer.addEventListener(Autodesk.Viewing.MODEL_ROOT_LOADED_EVENT, (ev) => {
        for (const ext of Object.values(App.extensions)) {
            if (ext.onModelLoaded) {
                ext.onModelLoaded(ev.model);
            }
        }
    });
});

async function setupModelSelection(viewer, selectedUrn) {
    const dropdown = document.getElementById('models');
    dropdown.innerHTML = '';
    try {
        const resp = await fetch('/api/aps/models');
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const models = await resp.json();
        dropdown.innerHTML = models.map(model => `<option value=${model.urn} ${model.urn === selectedUrn ? 'selected' : ''}>${model.name}</option>`).join('\n');
        dropdown.onchange = () => onModelSelected(viewer, dropdown.value);
        if (dropdown.value) {
            onModelSelected(viewer, dropdown.value);
        }
    } catch (err) {
        alert('Could not list models. See the console for more details.');
        console.error(err);
    }
}

async function setupModelUpload(viewer) {
    const upload = document.getElementById('upload');
    const input = document.getElementById('input');
    const models = document.getElementById('models');
    upload.onclick = () => input.click();
    input.onchange = async () => {
        const file = input.files[0];
        let data = new FormData();
        data.append('model-file', file);
        if (file.name.endsWith('.zip')) { // When uploading a zip file, ask for the main design file in the archive
            const entrypoint = window.prompt('Please enter the filename of the main design inside the archive.');
            data.append('model-zip-entrypoint', entrypoint);
        }
        upload.setAttribute('disabled', 'true');
        models.setAttribute('disabled', 'true');
        showNotification(`Uploading model <em>${file.name}</em>. Do not reload the page.`);
        try {
            const resp = await fetch('/api/aps/models', { method: 'POST', body: data });
            if (!resp.ok) {
                throw new Error(await resp.text());
            }
            const model = await resp.json();
            setupModelSelection(viewer, model.urn);
        } catch (err) {
            alert(`Could not upload model ${file.name}. See the console for more details.`);
            console.error(err);
        } finally {
            clearNotification();
            upload.removeAttribute('disabled');
            models.removeAttribute('disabled');
            input.value = '';
        }
    };
}

async function onModelSelected(viewer, urn) {
    if (window.onModelSelectedTimeout) {
        clearTimeout(window.onModelSelectedTimeout);
        delete window.onModelSelectedTimeout;
    }
    window.location.hash = urn;
    App.urn = urn;
    try {
        const resp = await fetch(`/api/aps/models/${urn}/status`);
        if (!resp.ok) {
            throw new Error(await resp.text());
        }
        const status = await resp.json();
        switch (status.status) {
            case 'n/a':
                showNotification(`Model has not been translated.`);
                break;
            case 'inprogress':
                showNotification(`Model is being translated (${status.progress})...`);
                window.onModelSelectedTimeout = setTimeout(onModelSelected, 5000, viewer, urn);
                break;
            case 'failed':
                showNotification(`Translation failed. <ul>${status.messages.map(msg => `<li>${JSON.stringify(msg)}</li>`).join('')}</ul>`);
                break;
            default:
                clearNotification();
                loadModel(viewer, urn);
                break;
        }
    } catch (err) {
        alert('Could not load model. See the console for more details.');
        console.error(err);
    }
}

function showNotification(message) {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = `<div class="notification">${message}</div>`;
    overlay.style.display = 'flex';
}

function clearNotification() {
    const overlay = document.getElementById('overlay');
    overlay.innerHTML = '';
    overlay.style.display = 'none';
}

function setupDashboard(viewer) {
    const div = document.createElement('div');
    div.id = 'dashboard';
    viewer.container.appendChild(div);
    App.extensions.LoggerExtension = viewer.getExtension('LoggerExtension');
    App.extensions.SummaryExtension = viewer.getExtension('SummaryExtension');
    App.extensions.HistogramExtension = viewer.getExtension('HistogramExtension');
    App.extensions.DataGridExtension = viewer.getExtension('DataGridExtension');
    for (const ext of Object.values(App.extensions)) {
        if (ext) {
            ext.panel = new DashboardPanel(div, ext.constructor.name + 'Panel', ext.constructor.name);
        }
    }
}

class DashboardPanel {
    constructor(parent, id, title) {
        this.container = document.createElement('div');
        this.container.id = id;
        this.container.classList.add('dashboard-panel');
        parent.appendChild(this.container);
        this.title = document.createElement('div');
        this.title.classList.add('title');
        this.title.textContent = title;
        this.container.appendChild(this.title);
        this.content = document.createElement('div');
        this.content.classList.add('content');
        this.container.appendChild(this.content);
        this.title.onclick = () => this.content.style.display = this.content.style.display === 'none' ? 'block' : 'none';
    }
}
