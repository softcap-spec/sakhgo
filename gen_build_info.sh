# Generate build info at build time
GIT_HASH=$(git rev-parse --short HEAD)
GIT_DATE=$(git log -1 --format=%cd --date=short HEAD)
GIT_MSG=$(git log -1 --format=%s HEAD | sed 's/"/\\"/g')
PKG_VER=$(node -p "require('./package.json').version")

cat > src/lib/build-info.ts << EOF
// Auto-generated at build time — do not edit manually
export const BUILD_VERSION = "${PKG_VER}";
export const BUILD_HASH = "${GIT_HASH}";
export const BUILD_DATE = "${GIT_DATE}";
export const BUILD_DESC = "${GIT_MSG}";
EOF

echo "Build info: v${PKG_VER} (${GIT_HASH} ${GIT_DATE})"
