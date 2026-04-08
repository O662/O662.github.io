(() => {
    const WRITINGS_URL = "writings/writings.json";
    const GRID_ID = "writings-grid";

    function titleFromFilename(path) {
        const base = path.split("/").pop() || "";
        const noExt = base.replace(/\.[^.]+$/, "");
        return noExt
            .replace(/[_-]+/g, " ")
            .replace(/\s+/g, " ")
            .trim()
            .replace(/\b\w/g, (match) => match.toUpperCase()) || "Untitled";
    }

    function shuffle(array) {
        const copy = array.slice();
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }

    function renderEmpty(grid) {
        grid.innerHTML = "";
        const empty = document.createElement("div");
        empty.className = "portfolio-item";
        empty.innerHTML =
            "<div class=\"portfolio-card placeholder writings-empty\">" +
            "<div class=\"portfolio-content\">" +
            "<h3>No writings yet</h3>" +
            "<p>Add PDF or HTML files to the writings folder and list them in writings/writings.json.</p>" +
            "</div>" +
            "</div>";
        grid.appendChild(empty);
    }

    function renderCards(entries, grid) {
        grid.innerHTML = "";
        entries.forEach((entry) => {
            const file = entry.file || "";
            if (!file) {
                return;
            }

            const extension = (file.split(".").pop() || "").toLowerCase();
            const isHtml = extension === "html" || extension === "htm";
            const label = extension ? extension.toUpperCase() : "FILE";
            const viewerUrl = isHtml
                ? `writings-viewer.html?doc=${encodeURIComponent(file)}`
                : file;
            const linkTarget = isHtml ? "_self" : "_blank";

            const title = entry.title && entry.title.trim()
                ? entry.title.trim()
                : titleFromFilename(file);
            const summary = entry.summary && entry.summary.trim()
                ? entry.summary.trim()
                : "Open the document.";

            const item = document.createElement("div");
            item.className = "portfolio-item";
            item.innerHTML =
                "<div class=\"portfolio-card writings-card\">" +
                "<div class=\"portfolio-image writings-preview\">" +
                `<div class=\"writings-preview-text\">${label}</div>` +
                "</div>" +
                "<div class=\"portfolio-content\">" +
                `<h3>${title}</h3>` +
                `<p>${summary}</p>` +
                `<a href=\"${viewerUrl}\" class=\"portfolio-link\" target=\"${linkTarget}\" rel=\"noopener\">Read</a>` +
                "</div>" +
                "</div>";
            grid.appendChild(item);
        });
    }

    function init() {
        const grid = document.getElementById(GRID_ID);
        if (!grid) {
            return;
        }

        fetch(WRITINGS_URL, { cache: "no-store" })
            .then((response) => response.json())
            .then((data) => {
                if (!Array.isArray(data) || data.length === 0) {
                    renderEmpty(grid);
                    return;
                }

                const picks = shuffle(data).slice(0, 3);
                renderCards(picks, grid);
            })
            .catch(() => {
                renderEmpty(grid);
            });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
