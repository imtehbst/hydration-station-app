# Artifact source backups

Source for the Claude artifacts, kept here so any change can be reverted.

| Folder | Artifact | Notes |
| --- | --- | --- |
| `fins-and-fangs/` | Fins & Fangs (12 game tabs) | `index.html` + `src/`. The artwork lives in the artifact itself and is not copied here. |
| `maze-wardens/` | Maze Wardens | Single `index.html`. |

## Restoring

Ask Claude to republish the folder from the commit you want over the existing artifact link.
For Fins & Fangs, publish `index.html` with every file under `src/`; the images already in the artifact stay as they are.

## Checks

`sh fins-and-fangs/tests/run.sh` runs the game-rules checks (Node 18+, nothing to install).
