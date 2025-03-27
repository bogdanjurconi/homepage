window.onload = function() {
    const correctCode = "1234";
    const content = document.querySelector('.content');
    const hasAccess = localStorage.getItem('hasAccess');
    
    function checkCode() {
        let userInput = prompt("Please enter access code:");
        
        if (userInput === correctCode) {
            content.style.display = 'block';
            localStorage.setItem('hasAccess', 'true');
        } else if (userInput === null) {
            document.body.innerHTML = "Access denied";
        } else {
            checkCode();
        }
    }
    
    if (!hasAccess) {
        checkCode();
    } else {
        content.style.display = 'block';
    }
};

// Dark mode toggle
const themeToggle = document.querySelector('.theme-toggle');
themeToggle.addEventListener('click', () => {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    
    const icon = themeToggle.querySelector('i');
    icon.className = newTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
    
    localStorage.setItem('theme', newTheme);
});

// Search functionality
const searchBox = document.querySelector('.search-box');
searchBox.addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    const sections = document.querySelectorAll('.section');
    
    sections.forEach(section => {
        const links = section.querySelectorAll('.links a');
        let visibleLinks = 0;
        
        links.forEach(link => {
            const text = link.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                link.classList.remove('hidden');
                visibleLinks++;
            } else {
                link.classList.add('hidden');
            }
        });
        
        if (visibleLinks === 0) {
            section.classList.add('hidden');
        } else {
            section.classList.remove('hidden');
        }
    });
});

// Function to save links to localStorage
function saveLinks() {
    const sections = document.querySelectorAll('.section');
    const data = {};
    
    sections.forEach(section => {
        const sectionName = section.querySelector('h2').textContent;
        const links = section.querySelectorAll('.links a');
        data[sectionName] = Array.from(links).map(link => ({
            name: link.textContent.trim(),
            url: link.href
        }));
    });
    
    localStorage.setItem('savedLinks', JSON.stringify(data));
}

// Function to load links from localStorage
function loadLinks() {
    const savedData = localStorage.getItem('savedLinks');
    if (!savedData) return;
    
    const data = JSON.parse(savedData);
    
    Object.entries(data).forEach(([sectionName, links]) => {
        const section = Array.from(document.querySelectorAll('.section'))
            .find(sec => sec.querySelector('h2').textContent.includes(sectionName));
        
        if (section) {
            const linksDiv = section.querySelector('.links');
            linksDiv.innerHTML = '';
            
            links.forEach(link => {
                const newLink = document.createElement('a');
                newLink.href = link.url;
                newLink.target = '_blank';
                newLink.innerHTML = `
                    ${link.name}
                    <button class="delete-btn" onclick="removeLink(event)">
                        <i class="fas fa-times"></i>
                    </button>
                `;
                linksDiv.appendChild(newLink);
            });
        }
    });
}

// Add new link function
function addNewLink() {
    const name = document.getElementById('linkName').value;
    const url = document.getElementById('linkUrl').value;
    const section = document.getElementById('linkSection').value;

    if (!name || !url) {
        alert('Please fill in both name and URL');
        return;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        alert('Please enter a valid URL starting with http:// or https://');
        return;
    }

    const sectionDiv = Array.from(document.querySelectorAll('.section'))
        .find(sec => sec.querySelector('h2').textContent.includes(section));

    if (sectionDiv) {
        const linksDiv = sectionDiv.querySelector('.links');
        const newLink = document.createElement('a');
        newLink.href = url;
        newLink.target = '_blank';
        newLink.innerHTML = `
            ${name}
            <button class="delete-btn" onclick="removeLink(event)">
                <i class="fas fa-times"></i>
            </button>
        `;
        linksDiv.appendChild(newLink);

        document.getElementById('linkName').value = '';
        document.getElementById('linkUrl').value = '';
        
        saveLinks();
    }
}

// Remove link function
function removeLink(event) {
    event.preventDefault();
    event.stopPropagation();
    if (confirm('Are you sure you want to remove this link?')) {
        event.target.closest('a').remove();
        saveLinks();
    }
}

// Load saved links when the page loads
window.addEventListener('load', loadLinks);

// Load theme preference
const savedTheme = localStorage.getItem('theme');
if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    const icon = themeToggle.querySelector('i');
    icon.className = savedTheme === 'light' ? 'fas fa-sun' : 'fas fa-moon';
}

// Edit mode functionality
const editToggle = document.querySelector('.edit-toggle');
const body = document.body;

editToggle.addEventListener('click', () => {
    body.classList.toggle('edit-mode');
    editToggle.classList.toggle('active');
    
    const span = editToggle.querySelector('span');
    const icon = editToggle.querySelector('i');
    if (body.classList.contains('edit-mode')) {
        span.textContent = 'Done';
        icon.className = 'fas fa-check';
        editToggle.style.background = '#28a745';
    } else {
        span.textContent = 'Edit';
        icon.className = 'fas fa-edit';
        editToggle.style.background = 'var(--link-bg)';
    }
});

// Save edit mode state
function saveEditMode() {
    localStorage.setItem('editMode', body.classList.contains('edit-mode'));
}

// Load edit mode state
const savedEditMode = localStorage.getItem('editMode');
if (savedEditMode === 'true') {
    body.classList.add('edit-mode');
    editToggle.classList.add('active');
    editToggle.querySelector('span').textContent = 'Done';
    editToggle.querySelector('i').className = 'fas fa-check';
    editToggle.style.background = '#28a745';
}

editToggle.addEventListener('click', saveEditMode);

// Color picker functionality
const colorDropdown = document.querySelector('.color-dropdown');
const colorButton = colorDropdown.querySelector('.color-button');
const colorOptions = document.querySelectorAll('.color-option');
const customColorPicker = document.querySelector('#customColor');
const root = document.documentElement;

colorButton.addEventListener('click', (e) => {
    e.stopPropagation();
    colorDropdown.classList.toggle('active');
});

document.addEventListener('click', (e) => {
    if (!colorDropdown.contains(e.target)) {
        colorDropdown.classList.remove('active');
    }
});

document.querySelector('.color-menu').addEventListener('click', (e) => {
    e.stopPropagation();
});

function updateAccentColor(color) {
    root.style.setProperty('--accent-color', color);
    const darkerColor = color + "dd";
    root.style.setProperty('--accent-hover', darkerColor);
    localStorage.setItem('accentColor', color);
    
    customColorPicker.value = color;
}

customColorPicker.addEventListener('input', (e) => {
    updateAccentColor(e.target.value);
});

colorOptions.forEach(option => {
    option.addEventListener('click', () => {
        updateAccentColor(option.dataset.color);
        colorDropdown.classList.remove('active');
    });
});

// Load saved accent color
const savedColor = localStorage.getItem('accentColor');
if (savedColor) {
    updateAccentColor(savedColor);
} else {
    updateAccentColor('#007bff');
} 