cmake_minimum_required(VERSION 3.15)
project(LedaProject CXX)

# Export compile commands so VSCode/clangd can find include paths
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# 1. Modernen C++ Standard für DEIN Projekt wählen (z.B. C++17)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# 2. XQuartz-Abhängigkeiten auf dem Mac finden
find_package(X11 REQUIRED)
find_library(XFT_LIBRARY NAMES Xft PATHS /opt/X11/lib REQUIRED)

# 3. LEDA Root-Verzeichnis definieren
set(LEDA_ROOT_DIR "${CMAKE_CURRENT_SOURCE_DIR}/../LEDA-7")

# 4. LEDA als "Importiertes Ziel" (Imported Target) definieren
add_library(LEDA STATIC IMPORTED)

# LEDA sagen, wo die Bibliothek und die Header-Dateien liegen
set_target_properties(LEDA PROPERTIES
    IMPORTED_LOCATION "${LEDA_ROOT_DIR}/libleda.a"
    INTERFACE_INCLUDE_DIRECTORIES "${LEDA_ROOT_DIR}/incl"
)

# X11, Xft und Math als feste Abhängigkeiten an LEDA binden.
# Das "INTERFACE" bedeutet: Wer LEDA nutzt, nutzt automatisch auch diese.
target_link_libraries(LEDA INTERFACE
    ${X11_LIBRARIES}
    ${XFT_LIBRARY}
    m
)

# Auch die XQuartz Include-Pfade an LEDA hängen
target_include_directories(LEDA INTERFACE
    ${X11_INCLUDE_DIR}
    /opt/X11/include/freetype2
)

# ==========================================
# Dein eigentliches Programm
# ==========================================

# Erstelle dein ausführbares Programm
add_executable(biedl_kant biedl_kant.cpp)


# Stelle LEDA-Header sicher sichtbar für das Ziel (für IntelliSense/clangd)
target_include_directories(biedl_kant PRIVATE "${LEDA_ROOT_DIR}/incl")

# Binde LEDA ein
target_link_libraries(biedl_kant PRIVATE LEDA)

# ==========================================
# Slope-Variante (Bekos et al., Theorem 4)
# ==========================================

# Interaktive GraphWin-App
add_executable(biedl_kant_slopes biedl_kant_slopes.cpp slopes_core.cpp planar_aug.cpp)
target_include_directories(biedl_kant_slopes PRIVATE "${LEDA_ROOT_DIR}/incl")
target_link_libraries(biedl_kant_slopes PRIVATE LEDA)

# Headless-Stresstest (Algorithmus + geometrischer Verifier)
add_executable(slopes_test slopes_test.cpp slopes_core.cpp planar_aug.cpp)
target_include_directories(slopes_test PRIVATE "${LEDA_ROOT_DIR}/incl")
target_link_libraries(slopes_test PRIVATE LEDA)

# ==========================================
# 1-Bend-Variante (Bekos et al., Theorem 1 + Korollar 2)
# ==========================================

# Headless-Stresstest
add_executable(onebend_test onebend_test.cpp onebend_core.cpp
               canonical_order.cpp planar_aug.cpp)
target_include_directories(onebend_test PRIVATE "${LEDA_ROOT_DIR}/incl")
target_link_libraries(onebend_test PRIVATE LEDA)

# Interaktive GraphWin-App
add_executable(onebend_slopes onebend_slopes.cpp onebend_core.cpp
               canonical_order.cpp planar_aug.cpp)
target_include_directories(onebend_slopes PRIVATE "${LEDA_ROOT_DIR}/incl")
target_link_libraries(onebend_slopes PRIVATE LEDA)
