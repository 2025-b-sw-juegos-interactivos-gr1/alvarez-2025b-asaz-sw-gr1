/* ============================================================================
   TÉCNICO TI - JUEGO 3D CON BABYLON.JS
   ============================================================================
   Un juego de simulación donde el jugador es un técnico de TI que debe
   recoger un servidor dañado y llevarlo a la zona de reparación.
   
   Tecnologías utilizadas:
   - Babylon.js 6.x: Motor de renderizado 3D WebGL
   - HTML5 Audio API: Sistema de sonidos
   - Babylon.js GUI: Interfaz de usuario en el juego
   ============================================================================ */

/* ============================================================================
   SECCIÓN 1: INICIALIZACIÓN DEL MOTOR Y CONSTANTES DE CONFIGURACIÓN
   ============================================================================
   Esta sección configura los parámetros fundamentales del juego:
   - Canvas: elemento HTML donde se renderiza el juego
   - Engine: motor de Babylon.js que maneja el renderizado WebGL
   - Constantes: valores que definen el comportamiento del juego
   ============================================================================ */
const canvas = document.getElementById("gameCanvas");
const engine = new BABYLON.Engine(canvas, true);  // true = antialiasing activado

// Configuración de movimiento y física
const MOVEMENT_SPEED = 0.2;        // Velocidad de desplazamiento del jugador
const FLOOR_LEVEL = 1;             // Altura del suelo en el mundo 3D
const GROUND_CENTER = new BABYLON.Vector3(-10, FLOOR_LEVEL + 0.5, 10);
const GROUND_LIMIT = 18;           // Límite del área de juego (evita salir del mapa)
const GROUND_LIMIT_BACK = 25;      // Límite extendido para movimiento hacia atrás

// Configuración de zonas de interacción
const PICKUP_ZONE_POSITION = new BABYLON.Vector3(16, FLOOR_LEVEL, 16);      // Posición del servidor
const PICKUP_ZONE_RADIUS = 1.25;
const DELIVERY_ZONE_POSITION = new BABYLON.Vector3(-16, FLOOR_LEVEL, -18);  // Zona de entrega
const DELIVERY_ZONE_RADIUS = PICKUP_ZONE_RADIUS;
const DELIVERY_ZONE_SIZE = DELIVERY_ZONE_RADIUS * 2;
const PICKUP_INTERACTION_DISTANCE = 3;    // Distancia para recoger el servidor
const DELIVERY_INTERACTION_DISTANCE = 5;  // Distancia para entregar el servidor
const OFFICE_TARGET_CENTER = new BABYLON.Vector3(0, FLOOR_LEVEL, 0);
const PLAYER_RADIUS = 0.5;  // Radio de colisión del jugador

/* ============================================================================
   SECCIÓN 2: SISTEMA DE COLISIONES
   ============================================================================
   Detecta si el jugador colisiona con obstáculos (escritorios).
   Utiliza Bounding Boxes (cajas delimitadoras) para verificar intersecciones.
   ============================================================================ */
const checkCollisionWithObstacles = (newX, newZ) => {
	for (const obstacle of obstacles) {
		if (!obstacle || !obstacle.getBoundingInfo) continue;
		
		// Obtener los límites del obstáculo en coordenadas del mundo
		const boundingBox = obstacle.getBoundingInfo().boundingBox;
		const minX = boundingBox.minimumWorld.x - PLAYER_RADIUS;
		const maxX = boundingBox.maximumWorld.x + PLAYER_RADIUS;
		const minZ = boundingBox.minimumWorld.z - PLAYER_RADIUS;
		const maxZ = boundingBox.maximumWorld.z + PLAYER_RADIUS;
		
		// Verificar si la nueva posición está dentro del obstáculo
		if (newX >= minX && newX <= maxX && newZ >= minZ && newZ <= maxZ) {
			return true;  // Hay colisión
		}
	}
	return false;  // No hay colisión
};

/* ============================================================================
   SECCIÓN 3: VARIABLES GLOBALES DEL JUEGO
   ============================================================================
   Referencias a los objetos 3D y estado del juego
   ============================================================================ */
let playerMesh = null;           // Modelo 3D del jugador (técnico)
let walkAnimationGroup = null;   // Animación de caminar del jugador
let serverMesh = null;           // Modelo 3D del servidor a transportar
let pickupRing = null;           // Anillo visual de zona de recogida
let pickupShield = null;         // Esfera visual de zona de recogida
let deliverySign = null;         // Letrero de zona de entrega
let deliveryOffice = null;       // Modelo de la oficina
let deliveryShield = null;       // Esfera visual de zona de entrega
let followCamera = null;         // Cámara que sigue al jugador
let obstacles = [];              // Array de obstáculos para colisiones
let elapsedTime = 0;             // Tiempo transcurrido (para animaciones)

// Estado del juego (máquina de estados simple)
let playerHasPackage = false;    // ¿El jugador tiene el servidor?
let currentPackage = null;       // Referencia al paquete actual
let gameState = "buscar_servidor";  // Estados: "buscar_servidor", "llevar_a_reparacion", "completado"

/* ============================================================================
   SECCIÓN 4: SISTEMA DE SONIDOS (Audio API HTML5)
   ============================================================================
   Variables para los efectos de sonido del juego
   ============================================================================ */
let bgMusic = null;        // Música de fondo ambiental (loop)
let footstepSound = null;  // Sonido de pasos al caminar
let pickupSound = null;    // Sonido "beep" al recoger servidor
let successSound = null;   // Sonido de éxito al completar misión
let soundsReady = false;   // Flag que indica si los sonidos están cargados

const packageStatusEl = document.getElementById("packageStatus");
const currentObjectiveEl = document.getElementById("currentObjective");
const feedbackEl = document.getElementById("feedbackMessage");
let feedbackTimeoutId = null;

const showFeedback = (message, duration = 3000) => {
	if (!feedbackEl) {
		return;
	}
	feedbackEl.textContent = message;
	feedbackEl.classList.add("is-visible");
	if (feedbackTimeoutId) {
		clearTimeout(feedbackTimeoutId);
	}
	feedbackTimeoutId = setTimeout(() => {
		feedbackEl.classList.remove("is-visible");
	}, duration);
};

/* ============================================================================
   SECCIÓN 5: SISTEMA DE PARTÍCULAS - EFECTO DE VICTORIA
   ============================================================================
   Crea una explosión de partículas cuando el jugador completa la misión.
   Utiliza el sistema de partículas de Babylon.js para efectos visuales.
   ============================================================================ */
const triggerVictoryEffect = () => {
	// Crear sistema de partículas con 150 partículas máximo
	const particleSystem = new BABYLON.ParticleSystem(`victoryParticles-${Date.now()}`, 150, scene);
	
	// Textura de las partículas (destello/flare)
	particleSystem.particleTexture = new BABYLON.Texture("https://assets.babylonjs.com/textures/flare.png", scene);
	
	// Posición del emisor (sobre la zona de entrega)
	particleSystem.emitter = DELIVERY_ZONE_POSITION.add(new BABYLON.Vector3(0, 1.5, 0));
	
	// Área de emisión (caja 3D desde donde salen las partículas)
	particleSystem.minEmitBox = new BABYLON.Vector3(-0.5, 0, -0.5);
	particleSystem.maxEmitBox = new BABYLON.Vector3(0.5, 0.5, 0.5);
	
	// Colores de las partículas (gradiente dorado a azul)
	particleSystem.color1 = new BABYLON.Color4(1, 0.9, 0.5, 1);    // Dorado
	particleSystem.color2 = new BABYLON.Color4(0.5, 0.8, 1, 1);    // Azul claro
	
	// Tamaño de las partículas
	particleSystem.minSize = 0.15;
	particleSystem.maxSize = 0.4;
	
	// Tiempo de vida de cada partícula
	particleSystem.minLifeTime = 0.3;
	particleSystem.maxLifeTime = 0.8;
	
	// Cantidad de partículas por segundo
	particleSystem.emitRate = 300;
	
	// Física de las partículas
	particleSystem.gravity = new BABYLON.Vector3(0, 0.5, 0);  // Flotan hacia arriba
	particleSystem.direction1 = new BABYLON.Vector3(-0.3, 1.5, 0.3);
	particleSystem.direction2 = new BABYLON.Vector3(0.3, 1.5, -0.3);
	
	// Iniciar y detener después de 1.2 segundos
	particleSystem.start();
	setTimeout(() => {
		particleSystem.stop();
		particleSystem.dispose();  // Liberar memoria
	}, 1200);
};

/* ============================================================================
   SECCIÓN 6: ACTUALIZACIÓN DE LA INTERFAZ DE USUARIO (UI)
   ============================================================================
   Actualiza los elementos HTML del HUD según el estado del juego
   ============================================================================ */
const updateUI = () => {
	// Actualizar estado del paquete
	if (packageStatusEl) {
		packageStatusEl.textContent = playerHasPackage ? "Sí, transportando" : "No, pendiente";
	}
	
	// Actualizar objetivo actual según el estado del juego
	if (currentObjectiveEl) {
		switch (gameState) {
			case "buscar_servidor":
				currentObjectiveEl.textContent = "Encuentra y recoge el servidor";
				break;
			case "llevar_a_reparacion":
				currentObjectiveEl.textContent = "Lleva el servidor a la zona de reparación";
				break;
			case "completado":
				currentObjectiveEl.textContent = "Trabajo completado. Buen trabajo";
				break;
			default:
				currentObjectiveEl.textContent = "";
		}
	}
};

updateUI();

/* ============================================================================
   SECCIÓN 7: TEXTO 3D BILLBOARD
   ============================================================================
   Crea letreros 3D que siempre miran hacia la cámara (billboard).
   Útil para señalización en el mundo 3D.
   ============================================================================ */
const createBillboardText = (
	scene,
	text,
	{ width = 6, height = 2.5, position = BABYLON.Vector3.Zero(), fontSize = 140 } = {}
) => {
	// Crear un plano 2D en el espacio 3D
	const plane = BABYLON.MeshBuilder.CreatePlane(
		`sign-${text}`,
		{ width, height },
		scene
	);
	
	// Modo billboard: el plano siempre rota para mirar a la cámara (solo en eje Y)
	plane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_Y;
	plane.position = position;
	
	// Crear material con textura dinámica para el texto
	const mat = new BABYLON.StandardMaterial("signMat", scene);
	const textureWidth = Math.round(width * 256);
	const textureHeight = Math.round(height * 256);
	
	// DynamicTexture permite dibujar texto en tiempo real
	const texture = new BABYLON.DynamicTexture("signTexture", { width: textureWidth, height: textureHeight }, scene, false);
	texture.hasAlpha = true;  // Fondo transparente
	texture.drawText(text, null, textureHeight * 0.7, `bold ${fontSize}px 'Segoe UI'`, "#ffffff", "transparent", true);
	
	mat.diffuseTexture = texture;
	mat.emissiveColor = new BABYLON.Color3(0.3, 0.8, 1);  // Brillo propio (efecto neón)
	mat.backFaceCulling = false;  // Visible desde ambos lados
	plane.material = mat;
	return plane;
};

/* ============================================================================
   SECCIÓN 8: SISTEMA DE ENTRADA (INPUT)
   ============================================================================
   Maneja el estado de las teclas presionadas para el movimiento
   ============================================================================ */
const inputState = {
	forward: false,   // W o Flecha arriba
	backward: false,  // S o Flecha abajo
	left: false,      // A o Flecha izquierda
	right: false      // D o Flecha derecha
};

/* ============================================================================
   SECCIÓN 9: MECÁNICA DE INTERACCIÓN (RECOGER/ENTREGAR)
   ============================================================================
   Lógica principal del gameplay: recoger servidor y entregarlo
   ============================================================================ */
const tryInteract = () => {
	if (!playerMesh) {
		return;
	}

	// MECÁNICA DE RECOGER: Si estamos buscando el servidor y estamos cerca
	if (gameState === "buscar_servidor" && serverMesh && !playerHasPackage) {
		// Calcular distancia entre jugador y servidor
		const distance = BABYLON.Vector3.Distance(playerMesh.position, serverMesh.getAbsolutePosition());
		
		if (distance <= PICKUP_INTERACTION_DISTANCE) {
			// Actualizar estado del juego
			playerHasPackage = true;
			currentPackage = serverMesh;
			
			// Resetear rotación del servidor para evitar problemas
			if (serverMesh.rotationQuaternion) {
				serverMesh.rotationQuaternion = null;
			}
			
			// IMPORTANTE: Hacer el servidor hijo del jugador
			// Esto hace que el servidor se mueva junto con el jugador
			serverMesh.setParent(playerMesh);
			serverMesh.position = new BABYLON.Vector3(0, 1.2, 1.1);  // Posición relativa al jugador
			serverMesh.rotation = BABYLON.Vector3.Zero();
			
			// Cambiar al siguiente estado del juego
			gameState = "llevar_a_reparacion";
			updateUI();
			showFeedback("¡Servidor recogido! Llévalo a reparación", 3500);
			
			// Reproducir sonido de recoger
			if (pickupSound) {
				pickupSound.currentTime = 0;  // Reiniciar el audio
				pickupSound.play().catch(e => console.error("Error pickup:", e));
				console.log("▶ Sonido pickup reproducido");
			}
		}
		return;
	}

	// MECÁNICA DE ENTREGAR: Si tenemos el servidor y estamos en la zona de entrega
	if (gameState === "llevar_a_reparacion" && playerHasPackage) {
		const distanceToDelivery = BABYLON.Vector3.Distance(playerMesh.position, DELIVERY_ZONE_POSITION);
		
		if (distanceToDelivery <= DELIVERY_INTERACTION_DISTANCE) {
			// Actualizar estado
			playerHasPackage = false;
			currentPackage = null;
			
			// Soltar el servidor en la zona de entrega
			if (serverMesh) {
				serverMesh.setParent(null);  // Ya no es hijo del jugador
				if (serverMesh.rotationQuaternion) {
					serverMesh.rotationQuaternion = null;
				}
				// Posicionar en el centro de la zona de entrega
				serverMesh.position = DELIVERY_ZONE_POSITION.add(new BABYLON.Vector3(0, 0.6, 0));
			}
			
			// Cambiar a estado completado
			gameState = "completado";
			updateUI();
			showFeedback("¡Misión completada! Servidor entregado para reparación", 4000);
			
			// Efectos de victoria
			triggerVictoryEffect();  // Partículas
			
			// Reproducir sonido de éxito
			if (successSound) {
				successSound.currentTime = 0;
				successSound.play().catch(e => console.error("Error success:", e));
				console.log("▶ Sonido success reproducido");
			}
			
			// Fade out de la música de fondo
			if (bgMusic && !bgMusic.paused) {
				const fadeOut = setInterval(() => {
					if (bgMusic.volume > 0.05) {
						bgMusic.volume -= 0.05;
					} else {
						bgMusic.pause();
						bgMusic.currentTime = 0;
						clearInterval(fadeOut);
					}
				}, 100);
			}
		}
	}
};

/* ============================================================================
   SECCIÓN 10: INICIALIZACIÓN DEL SISTEMA DE SONIDOS
   ============================================================================
   Carga los archivos de audio usando la API nativa de HTML5
   - bgMusic: música ambiental en loop
   - footstepSound: sonido de pasos
   - pickupSound: sonido al recoger
   - successSound: sonido de victoria
   ============================================================================ */
const initSounds = (scene) => {
	console.log("🔊 Inicializando sistema de sonidos...");
	
	// Usar Audio API nativa del navegador
	bgMusic = new Audio("./assets/sounds/ambient_music.wav");
	bgMusic.loop = true;
	bgMusic.volume = 0.3;
	bgMusic.addEventListener("canplaythrough", () => console.log("✓ Música de fondo cargada"));
	bgMusic.addEventListener("error", (e) => console.error("✗ Error cargando música:", e));

	footstepSound = new Audio("./assets/sounds/footsteps.mp3");
	footstepSound.loop = true;
	footstepSound.volume = 0.5;
	footstepSound.addEventListener("canplaythrough", () => console.log("✓ Sonido de pasos cargado"));
	footstepSound.addEventListener("error", (e) => console.error("✗ Error cargando pasos:", e));

	// Sonido de recoger servidor (efecto beep)
	pickupSound = new Audio("./assets/sounds/pickup_beep.wav");
	pickupSound.loop = false;   // No repetir
	pickupSound.volume = 0.6;
	pickupSound.addEventListener("canplaythrough", () => console.log("✓ Sonido pickup cargado"));
	pickupSound.addEventListener("error", (e) => console.error("✗ Error cargando pickup:", e));

	// Sonido de misión completada
	successSound = new Audio("./assets/sounds/success.wav");
	successSound.loop = false;
	successSound.volume = 0.7;
	successSound.addEventListener("canplaythrough", () => console.log("✓ Sonido success cargado"));
	successSound.addEventListener("error", (e) => console.error("✗ Error cargando success:", e));

	soundsReady = true;

	// IMPORTANTE: Los navegadores modernos requieren interacción del usuario
	// antes de reproducir audio automáticamente (política de autoplay)
	const startAudioOnInteraction = () => {
		console.log("🔊 Interacción detectada, iniciando audio...");
		bgMusic.play().then(() => {
			console.log("▶ Música de fondo iniciada");
		}).catch(err => {
			console.error("Error al reproducir música:", err);
		});
		
		// Remover listeners después de la primera interacción
		document.removeEventListener("click", startAudioOnInteraction);
		document.removeEventListener("keydown", startAudioOnInteraction);
	};
	
	// Escuchar click o tecla para iniciar audio
	document.addEventListener("click", startAudioOnInteraction);
	document.addEventListener("keydown", startAudioOnInteraction);
};

/* ============================================================================
   SECCIÓN 11: CREACIÓN DE LA ESCENA 3D
   ============================================================================
   Función principal que configura todo el mundo 3D:
   - Escena y efectos visuales (niebla, color de fondo)
   - Cámara de tercera persona
   - Iluminación
   - Objetos del escenario (escritorios, zonas)
   - Carga de modelos 3D
   ============================================================================ */
const createScene = () => {
	// Crear la escena principal de Babylon.js
	const scene = new BABYLON.Scene(engine);
	
	// Color de fondo (azul cielo claro)
	scene.clearColor = new BABYLON.Color4(0.69, 0.82, 0.97, 1);
	
	// Efecto de niebla para dar profundidad
	scene.fogMode = BABYLON.Scene.FOGMODE_EXP;  // Niebla exponencial
	scene.fogDensity = 0.01;
	scene.fogColor = new BABYLON.Color3(0.55, 0.7, 0.9);

	/* ========================================================================
	   CONFIGURACIÓN DE LA CÁMARA
	   ========================================================================
	   ArcRotateCamera: cámara que orbita alrededor de un objetivo
	   Perfecta para juegos en tercera persona
	   ======================================================================== */
	const camera = new BABYLON.ArcRotateCamera(
		"followCamera",
		BABYLON.Tools.ToRadians(180),  // Alpha: ángulo horizontal inicial (180° = detrás del jugador)
		BABYLON.Tools.ToRadians(60),   // Beta: ángulo vertical (60° = mirando desde arriba)
		10,                             // Radio: distancia al objetivo
		new BABYLON.Vector3(0, FLOOR_LEVEL + 2.5, 0),  // Objetivo inicial
		scene
	);
	followCamera = camera;
	
	// Límites de zoom (distancia mínima y máxima)
	camera.lowerRadiusLimit = 5;   // No puede acercarse más de 5 unidades
	camera.upperRadiusLimit = 12;  // No puede alejarse más de 12 unidades
	
	// Límites de ángulo vertical
	camera.lowerBetaLimit = BABYLON.Tools.ToRadians(45);  // No muy horizontal
	camera.upperBetaLimit = BABYLON.Tools.ToRadians(75);  // No muy vertical
	// Desplazamiento vertical en pantalla para centrar mejor al jugador
	camera.targetScreenOffset = new BABYLON.Vector2(0, -1);
	
	// Sensibilidad del zoom con rueda del mouse
	camera.wheelDeltaPercentage = 0.01;
	camera.pinchDeltaPercentage = 0.005;  // Para dispositivos táctiles
	
	camera.panningSensibility = 0;  // Desactivar paneo
	camera.inertia = 0;             // Sin inercia para control más directo
	camera.useInputToRestoreState = false;
	camera.attachControl(canvas, true);  // Activar controles de mouse

	// Configuración de sensibilidad del mouse para rotar la cámara
	if (camera.inputs?.attached?.pointers) {
		camera.inputs.attached.pointers.angularSensibilityX = 1200;  // Sensibilidad horizontal
		camera.inputs.attached.pointers.angularSensibilityY = 1200;  // Sensibilidad vertical
		camera.inputs.attached.pointers.buttons = [0, 1];  // Botones izquierdo y central
	}
	if (camera.inputs?.attached?.mousewheel) {
		camera.inputs.attached.mousewheel.wheelPrecision = 40;  // Precisión del zoom
	}

	/* ========================================================================
	   ILUMINACIÓN
	   ======================================================================== */
	// Luz hemisférica: simula luz ambiental del cielo
	const light = new BABYLON.HemisphericLight("globalLight", new BABYLON.Vector3(0, 1, 0), scene);
	light.intensity = 1;  // Intensidad máxima

	/* ========================================================================
	   CREACIÓN DE OBJETOS DE OFICINA (ESCRITORIOS)
	   ========================================================================
	   Función que genera los escritorios que servirán como obstáculos
	   ======================================================================== */
	const createOfficeProps = () => {
		// Posiciones predefinidas para los escritorios en el escenario
		const cubiclePositions = [
			new BABYLON.Vector3(5, 0, 0),
			new BABYLON.Vector3(-5, 0, 3),
			new BABYLON.Vector3(10, 0, -5),
			new BABYLON.Vector3(-12, 0, -2),
			new BABYLON.Vector3(3, 0, 10),
			new BABYLON.Vector3(-8, 0, 12)
		];

		// Crear cada escritorio con sus componentes
		cubiclePositions.forEach((position, index) => {
			// Ajustar posición al nivel del suelo
			const basePosition = position.add(new BABYLON.Vector3(0, FLOOR_LEVEL, 0));
			
			// ESCRITORIO: Caja 3D que representa la mesa
			const desk = BABYLON.MeshBuilder.CreateBox(
				`desk-${index}`,
				{ width: 2.4, depth: 1.2, height: 0.9 },  // Dimensiones del escritorio
				scene
			);
			desk.position = basePosition.add(new BABYLON.Vector3(0, 0.45, 0));  // Elevar a altura correcta
			
			// Material del escritorio (color aleatorio)
			const deskMat = new BABYLON.StandardMaterial(`deskMat-${index}`, scene);
			deskMat.diffuseColor = new BABYLON.Color3(0.5 + Math.random() * 0.2, 0.5, 0.55);
			desk.material = deskMat;
			
			// ¡IMPORTANTE! Añadir a la lista de obstáculos para colisiones
			desk.checkCollisions = true;
			obstacles.push(desk);

			// DIVISOR: Panel separador del cubículo
			const divider = BABYLON.MeshBuilder.CreateBox(
				`divider-${index}`,
				{ width: 0.1, depth: 1.2, height: 1.6 },
				scene
			);
			divider.position = desk.position.add(new BABYLON.Vector3(0, 0.8, -0.4));
			const dividerMat = new BABYLON.StandardMaterial(`dividerMat-${index}`, scene);
			dividerMat.diffuseColor = new BABYLON.Color3(0.35, 0.45, 0.6);
			divider.material = dividerMat;

			// MONITOR: Pantalla de computadora sobre el escritorio
			const monitor = BABYLON.MeshBuilder.CreateBox(
				`monitor-${index}`,
				{ width: 0.9, height: 0.5, depth: 0.05 },
				scene
			);
			monitor.position = desk.position.add(new BABYLON.Vector3(0, 0.75, 0));
			const monitorMat = new BABYLON.StandardMaterial(`monitorMat-${index}`, scene);
			monitorMat.diffuseColor = new BABYLON.Color3(0.1, 0.1, 0.1);  // Negro
			monitorMat.emissiveColor = new BABYLON.Color3(0.1, 0.3, 0.8);  // Brillo azul
			monitor.material = monitorMat;

			// CABLE: Cable de red/electricidad
			const cable = BABYLON.MeshBuilder.CreateCylinder(
				`cable-${index}`,
				{ height: 3.5, diameter: 0.05 },
				scene
			);
			cable.rotation.z = Math.PI / 2;  // Rotar para que quede horizontal
			cable.position = desk.position.add(new BABYLON.Vector3(-1, 0.05, 0.4));
			const cableMat = new BABYLON.StandardMaterial(`cableMat-${index}`, scene);
			cableMat.diffuseColor = new BABYLON.Color3(0.05, 0.05, 0.05);  // Negro
			cable.material = cableMat;
		});

		// LUCES PUNTUALES en zonas importantes
		// Iluminan las zonas de recogida y entrega para destacarlas
		const pointsOfInterest = [
			PICKUP_ZONE_POSITION,
			DELIVERY_ZONE_POSITION,
			new BABYLON.Vector3(-5, FLOOR_LEVEL, 10)
		];
		pointsOfInterest.forEach((position, index) => {
			const pointLight = new BABYLON.PointLight(
				`pointLight-${index}`,
				position.add(new BABYLON.Vector3(0, 4, 0)),  // 4 unidades arriba
				scene
			);
			pointLight.intensity = 0.8;
			pointLight.range = 15;  // Alcance de la luz
			pointLight.diffuse = new BABYLON.Color3(0.6, 0.8, 1);  // Azul claro
		});
	};

	// Ejecutar la función para crear los objetos de oficina
	createOfficeProps();

	// NOTA: El piso visible viene del modelo oficina.glb - no creamos otro

	/* ========================================================================
	   ZONA DE RECOGIDA DEL SERVIDOR
	   ======================================================================== */
	// Esfera semi-transparente que marca la zona de recogida
	const pickupShieldMat = new BABYLON.StandardMaterial("pickupShieldMat", scene);
	pickupShieldMat.emissiveColor = new BABYLON.Color3(0.35, 0.85, 1);  // Brillo azul
	pickupShieldMat.alpha = 0.18;  // Muy transparente
	
	pickupShield = BABYLON.MeshBuilder.CreateSphere("pickupShield", { diameter: PICKUP_ZONE_RADIUS * 4, segments: 24 }, scene);
	pickupShield.scaling.y = 0.7;  // Aplanar para que sea más como un domo
	pickupShield.position = PICKUP_ZONE_POSITION.add(new BABYLON.Vector3(0, PICKUP_ZONE_RADIUS * 1.2, 0));
	pickupShield.material = pickupShieldMat;
	pickupShield.isPickable = false;  // No se puede seleccionar con el mouse

	// Cartel flotante "SERVIDOR DAÑADO"
	const serverSign = createBillboardText(scene, "SERVIDOR DAÑADO", {
		width: 5,
		height: 1.4,
		fontSize: 80,
		position: PICKUP_ZONE_POSITION.add(new BABYLON.Vector3(0, 3.5, 0))
	});

	/* ========================================================================
	   ZONA DE ENTREGA (REPARACIÓN)
	   ======================================================================== */
	// Plataforma circular naranja que marca el destino
	const deliveryPlatform = BABYLON.MeshBuilder.CreateCylinder(
		"deliveryPlatform",
		{ diameter: DELIVERY_ZONE_SIZE, height: 0.4, tessellation: 48 },
		scene
	);
	deliveryPlatform.position = DELIVERY_ZONE_POSITION.add(new BABYLON.Vector3(0, 0.3, 0));
	const deliveryMat = new BABYLON.StandardMaterial("deliveryMat", scene);
	deliveryMat.diffuseColor = new BABYLON.Color3(1, 0.67, 0.2);   // Naranja
	deliveryMat.emissiveColor = new BABYLON.Color3(0.45, 0.18, 0.02);  // Brillo naranja
	deliveryPlatform.material = deliveryMat;

	// Esfera semi-transparente de la zona de entrega
	const deliveryShieldMat = new BABYLON.StandardMaterial("deliveryShieldMat", scene);
	deliveryShieldMat.emissiveColor = new BABYLON.Color3(0.3, 0.7, 1);
	deliveryShieldMat.alpha = 0.2;
	deliveryShield = BABYLON.MeshBuilder.CreateSphere("deliveryShield", { diameter: DELIVERY_ZONE_RADIUS * 4, segments: 24 }, scene);
	deliveryShield.scaling.y = 0.65;
	deliveryShield.position = DELIVERY_ZONE_POSITION.add(new BABYLON.Vector3(0, DELIVERY_ZONE_RADIUS * 1.1, 0));
	deliveryShield.material = deliveryShieldMat;
	deliveryShield.isPickable = false;

	// Cartel flotante "ZONA DE REPARACIÓN"
	deliverySign = createBillboardText(scene, "ZONA DE REPARACIÓN", {
		width: 5,
		height: 1.4,
		fontSize: 80,
		position: DELIVERY_ZONE_POSITION.add(new BABYLON.Vector3(0, 1.4, -1.2))
	});
	deliverySign.metadata = { baseY: deliverySign.position.y };  // Guardar posición Y para animación

	// Luz de foco que ilumina la zona de entrega desde arriba
	const deliverySpot = new BABYLON.SpotLight(
		"deliverySpot",
		DELIVERY_ZONE_POSITION.add(new BABYLON.Vector3(0, 10, 0)),  // 10 unidades arriba
		new BABYLON.Vector3(0, -1, 0),  // Apuntando hacia abajo
		Math.PI / 3,   // Ángulo del cono de luz (60°)
		2,             // Exponente de atenuación
		scene
	);
	deliverySpot.diffuse = new BABYLON.Color3(1, 0.9, 0.6);   // Amarillo cálido
	deliverySpot.specular = new BABYLON.Color3(1, 0.9, 0.6);
	deliverySpot.intensity = 2.5;

	/* ========================================================================
	   FUNCIONES DE RESPALDO (PLACEHOLDER)
	   ========================================================================
	   Se usan cuando los modelos GLB no se pueden cargar
	   ======================================================================== */
	
	// Crear un jugador de respaldo (cápsula simple)
	const spawnPlayerPlaceholder = () => {
		const capsule = BABYLON.MeshBuilder.CreateCapsule("playerPlaceholder", { radius: 0.4, height: 1.8 }, scene);
		capsule.position = new BABYLON.Vector3(0, FLOOR_LEVEL, 0);
		const mat = new BABYLON.StandardMaterial("playerPlaceholderMat", scene);
		mat.diffuseColor = new BABYLON.Color3(0.15, 0.7, 1);  // Azul
		mat.emissiveColor = new BABYLON.Color3(0.05, 0.2, 0.6);
		capsule.material = mat;
		playerMesh = capsule;
		camera.lockedTarget = playerMesh;  // La cámara sigue al jugador
		walkAnimationGroup = null;
		console.warn("Usando mesh placeholder para el jugador (tecnico.glb no disponible)");
	};

	// Crear un servidor de respaldo (cubo simple)
	const spawnServerPlaceholder = () => {
		const crate = BABYLON.MeshBuilder.CreateBox("serverPlaceholder", { size: 1 }, scene);
		crate.position = PICKUP_ZONE_POSITION.add(new BABYLON.Vector3(0, 0.6, 0));
		const mat = new BABYLON.StandardMaterial("serverPlaceholderMat", scene);
		mat.diffuseColor = new BABYLON.Color3(0.2, 0.95, 0.4);  // Verde
		mat.emissiveColor = new BABYLON.Color3(0.05, 0.4, 0.1);
		crate.material = mat;
		serverMesh = crate;
		console.warn("Usando mesh placeholder para el servidor (servidor.glb no disponible)");
	};

	/* ========================================================================
	   SECCIÓN 12: CARGA DE MODELOS 3D
	   ========================================================================
	   Funciones callback que se ejecutan cuando los modelos GLB terminan
	   de cargar. Configuran los materiales, escalas y posiciones.
	   ======================================================================== */

	/**
	 * handlePlayerLoaded - Procesa el modelo del jugador cuando carga
	 * @param {Array} meshes - Lista de meshes que componen el modelo
	 * @param {Array} animationGroups - Animaciones del modelo (caminar, etc.)
	 */
	const handlePlayerLoaded = (meshes = [], animationGroups = []) => {
		// Si no hay meshes, usar el placeholder
		if (!meshes.length) {
			spawnPlayerPlaceholder();
			return;
		}

		// Crear material azul para el técnico
		const playerMaterial = new BABYLON.StandardMaterial("playerMat", scene);
		playerMaterial.diffuseColor = new BABYLON.Color3(0.1, 0.7, 0.95);

		// Escalar el modelo (los modelos GLB suelen venir muy grandes)
		const baseScale = 0.2;  // 20% del tamaño original
		meshes.forEach((mesh, index) => {
			if (index === 0) {
				// El mesh principal va en la posición inicial
				mesh.position = new BABYLON.Vector3(0, FLOOR_LEVEL, 0);
			}
			// Aplicar escala a cada parte del modelo
			const currentScale = mesh.scaling || new BABYLON.Vector3(1, 1, 1);
			mesh.scaling = new BABYLON.Vector3(
				currentScale.x * baseScale,
				currentScale.y * baseScale,
				currentScale.z * baseScale
			);
			mesh.material = playerMaterial;
		});

		// Guardar referencia al mesh principal
		playerMesh = meshes[0];
		playerMesh.position.y = FLOOR_LEVEL;
		
		// Hacer que la cámara siga al jugador
		camera.lockedTarget = playerMesh;
		
		// Buscar la animación de caminar entre las disponibles
		walkAnimationGroup = animationGroups?.find((group) => group.name.toLowerCase().includes("walk")) || animationGroups?.[0] || null;
		if (walkAnimationGroup) {
			walkAnimationGroup.loopAnimation = true;  // La animación se repite
		}
	};

	/**
	 * handleServerLoaded - Procesa el modelo del servidor cuando carga
	 * @param {Array} meshes - Lista de meshes del modelo servidor
	 */
	const handleServerLoaded = (meshes = []) => {
		if (!meshes.length) {
			spawnServerPlaceholder();
			return;
		}

		// Material verde brillante para el servidor
		const serverMaterial = new BABYLON.StandardMaterial("serverMat", scene);
		serverMaterial.diffuseColor = new BABYLON.Color3(0.2, 0.9, 0.4);
		serverMaterial.emissiveColor = new BABYLON.Color3(0.05, 0.5, 0.2);  // Brillo verde
		const serverScale = 0.18;  // Escala del servidor

		meshes.forEach((mesh, index) => {
			if (index === 0) {
				// Posicionar en la zona de recogida
				mesh.position = PICKUP_ZONE_POSITION.add(new BABYLON.Vector3(0, 0.45, 0));
			}
			mesh.material = serverMaterial;
			const currentScale = mesh.scaling || new BABYLON.Vector3(1, 1, 1);
			mesh.scaling = new BABYLON.Vector3(
				currentScale.x * serverScale,
				currentScale.y * serverScale,
				currentScale.z * serverScale
			);
		});

		serverMesh = meshes[0];
	};

	/**
	 * alignOfficeModel - Centra y alinea el modelo de la oficina
	 * Calcula el bounding box total y lo posiciona correctamente
	 */
	const alignOfficeModel = (meshList = []) => {
		if (!meshList.length) {
			return;
		}

		// Calcular los límites del modelo completo (bounding box)
		let min = new BABYLON.Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
		let max = new BABYLON.Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

		meshList.forEach((mesh) => {
			mesh.computeWorldMatrix(true);  // Actualizar transformaciones
			const boundingInfo = mesh.getBoundingInfo();
			min = BABYLON.Vector3.Minimize(min, boundingInfo.boundingBox.minimumWorld);
			max = BABYLON.Vector3.Maximize(max, boundingInfo.boundingBox.maximumWorld);
		});

		// Centrar el modelo en OFFICE_TARGET_CENTER
		const center = min.add(max).scale(0.5);
		const offset = OFFICE_TARGET_CENTER.subtract(center);
		meshList.forEach((mesh) => {
			mesh.position.addInPlace(offset);
		});
		
		// Ajustar la altura del suelo
		const desiredFloorHeight = FLOOR_LEVEL + 2;
		const floorY = min.y + offset.y;
		const groundLift = desiredFloorHeight - floorY;
		if (groundLift !== 0) {
			meshList.forEach((mesh) => {
				mesh.position.y += groundLift;
			});
		}
	};

	/* ========================================================================
	   CARGA DE MODELOS CON SceneLoader.ImportMesh
	   ========================================================================
	   ImportMesh es la función principal de Babylon.js para cargar modelos 3D.
	   Parámetros:
	   1. "" - nombres de meshes a importar (vacío = todos)
	   2. "assets/models/" - ruta de la carpeta
	   3. "archivo.glb" - nombre del archivo
	   4. scene - la escena donde cargar
	   5. callback de éxito - se ejecuta cuando el modelo carga
	   6. callback de progreso (undefined = no usado)
	   7. callback de error - se ejecuta si hay problemas
	   ======================================================================== */

	// CARGAR MODELO DEL JUGADOR (tecnico.glb)
	BABYLON.SceneLoader.ImportMesh(
		"",
		"assets/models/",
		"tecnico.glb",
		scene,
		(meshes, particleSystems, skeletons, animationGroups) => {
			// Éxito: procesar el modelo cargado
			handlePlayerLoaded(meshes, animationGroups);
		},
		undefined,  // No usamos callback de progreso
		(scene, message, exception) => {
			// Error: mostrar en consola y usar placeholder
			console.error("Error al cargar tecnico.glb", message, exception);
			spawnPlayerPlaceholder();
		}
	);

	// CARGAR MODELO DEL SERVIDOR (servidor.glb)
	BABYLON.SceneLoader.ImportMesh(
		"",
		"assets/models/",
		"servidor.glb",
		scene,
		(meshes) => {
			handleServerLoaded(meshes);  // Procesar modelo cargado
		},
		undefined,
		(scene, message, exception) => {
			console.error("Error al cargar servidor.glb", message, exception);
			spawnServerPlaceholder();  // Usar cubo de respaldo
		}
	);

	// CARGAR MODELO DE LA OFICINA (oficina.glb) - El escenario principal
	BABYLON.SceneLoader.ImportMesh(
		"",
		"assets/models/",
		"oficina.glb",
		scene,
		(meshes) => {
			if (!meshes.length) {
				console.warn("oficina.glb no contiene meshes");
				return;
			}
			// Solo escalar el nodo raíz (primer mesh)
			const root = meshes[0];
			// Escala aumentada para que el escenario sea más grande
			root.scaling = new BABYLON.Vector3(1.96, 1.96, 2.3);
			// Elevar la oficina para alinear el piso con el jugador
			root.position = new BABYLON.Vector3(0, 1.1, 0);
			deliveryOffice = root;  // Guardar referencia
		}
	);

	// Retornar la escena configurada
	return scene;
};

/* ============================================================================
   SECCIÓN 13: INICIALIZACIÓN DEL JUEGO
   ============================================================================ */

// Crear la escena llamando a la función principal
const scene = createScene();

// Inicializar el sistema de sonidos
initSounds(scene);

/* ============================================================================
   SECCIÓN 14: INTERFAZ DE USUARIO CON BABYLON.JS GUI
   ============================================================================
   Babylon.js GUI es un sistema de UI 2D integrado que se renderiza sobre
   la escena 3D. Es más eficiente que usar HTML porque se dibuja en el mismo
   canvas de WebGL.
   ============================================================================ */

// Crear la textura de pantalla completa para la GUI
const advancedTexture = BABYLON.GUI.AdvancedDynamicTexture.CreateFullscreenUI("UI", true, scene);

/* ------------------------------------------------------------------------
   PANEL SUPERIOR - Título del juego
   ------------------------------------------------------------------------ */
const topPanel = new BABYLON.GUI.Rectangle("topPanel");
topPanel.width = "400px";
topPanel.height = "80px";
topPanel.cornerRadius = 12;
topPanel.color = "rgba(79, 186, 255, 0.6)";    // Borde azul claro
topPanel.thickness = 2;
topPanel.background = "rgba(3, 7, 21, 0.85)";  // Fondo oscuro semi-transparente
topPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;  // Centrado horizontal
topPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;          // Arriba
topPanel.top = "20px";  // Separación del borde superior
advancedTexture.addControl(topPanel);

// Texto del título
const titleText = new BABYLON.GUI.TextBlock("titleText");
titleText.text = "🖥️ TÉCNICO TI";
titleText.color = "#6fd6ff";   // Azul cyan
titleText.fontSize = 28;
titleText.fontFamily = "Segoe UI";
titleText.fontWeight = "bold";
titleText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
topPanel.addControl(titleText);  // Añadir como hijo del panel

/* ------------------------------------------------------------------------
   PANEL DE OBJETIVO - Muestra la misión actual
   ------------------------------------------------------------------------ */
const objectivePanel = new BABYLON.GUI.Rectangle("objectivePanel");
objectivePanel.width = "350px";
objectivePanel.height = "50px";
objectivePanel.cornerRadius = 8;
objectivePanel.color = "rgba(255, 224, 131, 0.5)";  // Borde amarillo
objectivePanel.thickness = 1;
objectivePanel.background = "rgba(3, 7, 21, 0.75)";
objectivePanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
objectivePanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
objectivePanel.top = "110px";
advancedTexture.addControl(objectivePanel);

// Texto del objetivo (se actualiza según el estado del juego)
const objectiveText = new BABYLON.GUI.TextBlock("objectiveText");
objectiveText.text = "🎯 Encuentra y recoge el servidor";
objectiveText.color = "#ffe083";  // Amarillo
objectiveText.fontSize = 16;
objectiveText.fontFamily = "Segoe UI";
objectiveText.fontWeight = "600";
objectivePanel.addControl(objectiveText);

/* ------------------------------------------------------------------------
   BARRA DE PROXIMIDAD - Indica qué tan cerca está del objetivo
   ------------------------------------------------------------------------ */
const proximityContainer = new BABYLON.GUI.Rectangle("proximityContainer");
proximityContainer.width = "200px";
proximityContainer.height = "30px";
proximityContainer.cornerRadius = 6;
proximityContainer.color = "rgba(79, 186, 255, 0.4)";
proximityContainer.thickness = 1;
proximityContainer.background = "rgba(3, 7, 21, 0.7)";
proximityContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_CENTER;
proximityContainer.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
proximityContainer.top = "-80px";
proximityContainer.isVisible = false;  // Oculto por defecto, se muestra al acercarse
advancedTexture.addControl(proximityContainer);

// Etiqueta "PROXIMIDAD"
const proximityLabel = new BABYLON.GUI.TextBlock("proximityLabel");
proximityLabel.text = "PROXIMIDAD";
proximityLabel.color = "#8cd9ff";
proximityLabel.fontSize = 10;
proximityLabel.fontFamily = "Segoe UI";
proximityLabel.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
proximityLabel.top = "2px";
proximityContainer.addControl(proximityLabel);

// Fondo de la barra de progreso
const proximityBarBg = new BABYLON.GUI.Rectangle("proximityBarBg");
proximityBarBg.width = "180px";
proximityBarBg.height = "8px";
proximityBarBg.cornerRadius = 4;
proximityBarBg.color = "transparent";
proximityBarBg.background = "rgba(255, 255, 255, 0.15)";
proximityBarBg.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
proximityBarBg.top = "-6px";
proximityContainer.addControl(proximityBarBg);

// Relleno de la barra (ancho dinámico según proximidad)
const proximityBarFill = new BABYLON.GUI.Rectangle("proximityBarFill");
proximityBarFill.width = "0px";  // Empieza vacía
proximityBarFill.height = "8px";
proximityBarFill.cornerRadius = 4;
proximityBarFill.color = "transparent";
proximityBarFill.background = "linear-gradient(90deg, #6fd6ff, #00ff88)";  // Gradiente azul-verde
proximityBarFill.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
proximityBarBg.addControl(proximityBarFill);

/* ------------------------------------------------------------------------
   MINIMAPA - Vista aérea simplificada del escenario
   ------------------------------------------------------------------------ */
const minimapSize = 300;  // Tamaño en píxeles
const minimapContainer = new BABYLON.GUI.Rectangle("minimapContainer");
minimapContainer.width = `${minimapSize + 20}px`;
minimapContainer.height = `${minimapSize + 50}px`;
minimapContainer.cornerRadius = 16;
minimapContainer.color = "rgba(79, 186, 255, 0.5)";
minimapContainer.thickness = 3;
minimapContainer.background = "rgba(3, 7, 21, 0.85)";
minimapContainer.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;  // Esquina derecha
minimapContainer.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
minimapContainer.top = "20px";
minimapContainer.left = "-20px";
advancedTexture.addControl(minimapContainer);

// Título del minimapa
const minimapTitle = new BABYLON.GUI.TextBlock("minimapTitle");
minimapTitle.text = "MAPA";
minimapTitle.color = "#8cd9ff";
minimapTitle.fontSize = 22;
minimapTitle.fontFamily = "Segoe UI";
minimapTitle.fontWeight = "bold";
minimapTitle.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
minimapTitle.top = "10px";
minimapContainer.addControl(minimapTitle);

// Área del minimapa donde se dibujan los elementos
const minimapArea = new BABYLON.GUI.Rectangle("minimapArea");
minimapArea.width = `${minimapSize}px`;
minimapArea.height = `${minimapSize}px`;
minimapArea.cornerRadius = 8;
minimapArea.color = "transparent";
minimapArea.background = "rgba(20, 40, 60, 0.9)";  // Fondo azul oscuro
minimapArea.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
minimapArea.top = "-10px";
minimapContainer.addControl(minimapArea);

// Indicador del jugador en el minimapa (círculo azul)
const minimapPlayer = new BABYLON.GUI.Ellipse("minimapPlayer");
minimapPlayer.width = "24px";
minimapPlayer.height = "24px";
minimapPlayer.color = "#00ffff";     // Borde cyan
minimapPlayer.thickness = 3;
minimapPlayer.background = "#0088ff"; // Relleno azul
minimapArea.addControl(minimapPlayer);

// Indicador de dirección del jugador (círculo blanco pequeño)
const minimapPlayerDir = new BABYLON.GUI.Ellipse("minimapPlayerDir");
minimapPlayerDir.width = "12px";
minimapPlayerDir.height = "12px";
minimapPlayerDir.color = "transparent";
minimapPlayerDir.background = "#ffffff";
minimapPlayerDir.top = "-20px";  // Posición relativa que se actualiza cada frame
minimapArea.addControl(minimapPlayerDir);

// Zona de recogida en minimapa (punto verde)
const minimapPickup = new BABYLON.GUI.Ellipse("minimapPickup");
minimapPickup.width = "20px";
minimapPickup.height = "20px";
minimapPickup.color = "#00ff00";
minimapPickup.thickness = 3;
minimapPickup.background = "#00aa00";
minimapArea.addControl(minimapPickup);

// Zona de entrega en minimapa (punto naranja)
const minimapDelivery = new BABYLON.GUI.Ellipse("minimapDelivery");
minimapDelivery.width = "20px";
minimapDelivery.height = "20px";
minimapDelivery.color = "#ffaa00";
minimapDelivery.thickness = 3;
minimapDelivery.background = "#ff6600";
minimapArea.addControl(minimapDelivery);

/* ------------------------------------------------------------------------
   PANEL DE CONTROLES - Instrucciones para el jugador
   ------------------------------------------------------------------------ */
const controlsPanel = new BABYLON.GUI.Rectangle("controlsPanel");
controlsPanel.width = "540px";
controlsPanel.height = "300px";
controlsPanel.cornerRadius = 24;
controlsPanel.color = "rgba(79, 186, 255, 0.4)";
controlsPanel.thickness = 3;
controlsPanel.background = "rgba(3, 7, 21, 0.75)";
controlsPanel.horizontalAlignment = BABYLON.GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;  // Esquina izquierda
controlsPanel.verticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;     // Abajo
controlsPanel.left = "20px";
controlsPanel.top = "-20px";
advancedTexture.addControl(controlsPanel);

// Título "CONTROLES"
const controlsTitle = new BABYLON.GUI.TextBlock("controlsTitle");
controlsTitle.text = "CONTROLES";
controlsTitle.color = "#8cd9ff";
controlsTitle.fontSize = 33;
controlsTitle.fontFamily = "Segoe UI";
controlsTitle.fontWeight = "bold";
controlsTitle.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_TOP;
controlsTitle.top = "24px";
controlsPanel.addControl(controlsTitle);

// Texto con las instrucciones de control
const controlsText = new BABYLON.GUI.TextBlock("controlsText");
controlsText.text = "W A S D · Mover\nE · Interactuar\nMouse · Rotar cámara";
controlsText.color = "#ffffff";
controlsText.fontSize = 36;
controlsText.fontFamily = "Segoe UI";
controlsText.textVerticalAlignment = BABYLON.GUI.Control.VERTICAL_ALIGNMENT_CENTER;
controlsText.top = "36px";
controlsText.lineSpacing = "18px";
controlsPanel.addControl(controlsText);

/* ============================================================================
   SECCIÓN 15: ACTUALIZACIÓN DE LA GUI EN TIEMPO REAL
   ============================================================================ */

/**
 * updateBabylonGUI - Actualiza todos los elementos de la GUI cada frame
 * Se llama desde el render loop para mantener la UI sincronizada
 */
const updateBabylonGUI = () => {
	if (!playerMesh) return;  // Esperar a que el jugador esté cargado
	
	// Actualizar texto del objetivo según el estado del juego
	switch (gameState) {
		case "buscar_servidor":
			objectiveText.text = "🎯 Encuentra y recoge el servidor";
			break;
		case "llevar_a_reparacion":
			objectiveText.text = "📦 Lleva el servidor a reparación";
			break;
		case "completado":
			objectiveText.text = "✅ ¡Misión completada!";
			break;
	}
	
	// BARRA DE PROXIMIDAD: Calcula qué tan cerca está del objetivo
	let proximityValue = 0;
	let showProximity = false;
	
	// Si está buscando el servidor, calcular distancia al servidor
	if (gameState === "buscar_servidor" && serverMesh) {
		const distToServer = BABYLON.Vector3.Distance(playerMesh.position, serverMesh.getAbsolutePosition());
		if (distToServer < PICKUP_INTERACTION_DISTANCE * 2) {
			showProximity = true;
			// Valor entre 0 y 1, donde 1 = muy cerca
			proximityValue = Math.max(0, 1 - (distToServer / (PICKUP_INTERACTION_DISTANCE * 2)));
		}
	}
	// Si lleva el servidor, calcular distancia a la zona de entrega
	else if (gameState === "llevar_a_reparacion") {
		const distToDelivery = BABYLON.Vector3.Distance(playerMesh.position, DELIVERY_ZONE_POSITION);
		if (distToDelivery < DELIVERY_INTERACTION_DISTANCE * 2) {
			showProximity = true;
			proximityValue = Math.max(0, 1 - (distToDelivery / (DELIVERY_INTERACTION_DISTANCE * 2)));
		}
	}
	
	// Mostrar u ocultar la barra de proximidad
	proximityContainer.isVisible = showProximity;
	if (showProximity) {
		const barWidth = Math.floor(proximityValue * 180);  // Máximo 180px de ancho
		proximityBarFill.width = `${barWidth}px`;
		
		// Cambiar color según qué tan cerca está
		if (proximityValue > 0.7) {
			proximityBarFill.background = "#00ff88";  // Verde = muy cerca
		} else if (proximityValue > 0.4) {
			proximityBarFill.background = "#ffdd00";  // Amarillo = cerca
		} else {
			proximityBarFill.background = "#6fd6ff";  // Azul = algo cerca
		}
	}
	
	/* ------------------------------------------------------------------------
	   ACTUALIZACIÓN DEL MINIMAPA
	   Convierte las posiciones del mundo 3D a coordenadas 2D del minimapa
	   ------------------------------------------------------------------------ */
	// Factor de escala: convierte unidades del mundo a píxeles del minimapa
	const mapScale = minimapSize / (GROUND_LIMIT * 2 + 10);
	
	// Posición del jugador en el minimapa
	const playerMapX = playerMesh.position.x * mapScale;
	const playerMapZ = -playerMesh.position.z * mapScale;  // Invertir Z para orientación correcta
	minimapPlayer.left = `${playerMapX}px`;
	minimapPlayer.top = `${playerMapZ}px`;
	
	// Indicador de dirección del jugador
	// Calcula dónde dibujar el punto blanco según hacia dónde mira el jugador
	const dirOffset = 12;  // Distancia del centro del jugador
	const dirX = playerMapX - Math.sin(playerMesh.rotation.y) * dirOffset;
	const dirZ = playerMapZ + Math.cos(playerMesh.rotation.y) * dirOffset;
	minimapPlayerDir.left = `${dirX}px`;
	minimapPlayerDir.top = `${dirZ}px`;
	
	// Posición de la zona de recogida (servidor)
	const pickupMapX = PICKUP_ZONE_POSITION.x * mapScale;
	const pickupMapZ = -PICKUP_ZONE_POSITION.z * mapScale;
	minimapPickup.left = `${pickupMapX}px`;
	minimapPickup.top = `${pickupMapZ}px`;
	// Solo mostrar si aún no ha recogido el servidor
	minimapPickup.isVisible = (gameState === "buscar_servidor");
	
	// Posición de la zona de entrega
	const deliveryMapX = DELIVERY_ZONE_POSITION.x * mapScale;
	const deliveryMapZ = -DELIVERY_ZONE_POSITION.z * mapScale;
	minimapDelivery.left = `${deliveryMapX}px`;
	minimapDelivery.top = `${deliveryMapZ}px`;
	// Solo mostrar cuando lleva el servidor
	minimapDelivery.isVisible = (gameState === "llevar_a_reparacion");
};

/* ============================================================================
   SECCIÓN 16: MANEJO DE ENTRADA DE TECLADO
   ============================================================================ */

/**
 * handleInput - Procesa las teclas presionadas y actualiza el estado de entrada
 * @param {string} key - La tecla presionada (en minúsculas)
 * @param {boolean} pressed - true si se presionó, false si se soltó
 */
const handleInput = (key, pressed) => {
	switch (key) {
		// Movimiento con WASD o flechas
		case "w":
		case "arrowup":
			inputState.forward = pressed;
			break;
		case "s":
		case "arrowdown":
			inputState.backward = pressed;
			break;
		case "a":
		case "arrowleft":
			inputState.left = pressed;
			break;
		case "d":
		case "arrowright":
			inputState.right = pressed;
			break;
		// Tecla E para interactuar
		case "e":
			if (pressed) {
				tryInteract();  // Intentar recoger/entregar
			}
			break;
	}
};

// Registrar el observador de teclado en la escena de Babylon.js
scene.onKeyboardObservable.add((kbInfo) => {
	if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYDOWN) {
		handleInput(kbInfo.event.key.toLowerCase(), true);
	} else if (kbInfo.type === BABYLON.KeyboardEventTypes.KEYUP) {
		handleInput(kbInfo.event.key.toLowerCase(), false);
	}
});

/* ============================================================================
   SECCIÓN 17: RENDER LOOP (BUCLE DE RENDERIZADO)
   ============================================================================
   El render loop es el corazón del juego. Se ejecuta cada frame (~60 veces
   por segundo) y actualiza toda la lógica del juego:
   - Movimiento del jugador
   - Animaciones
   - Cámara
   - Física y colisiones
   - Interfaz de usuario
   ============================================================================ */

let isWalking = false;  // Estado de la animación de caminar
let targetPlayerRotationY = 0;  // Ángulo de rotación objetivo del jugador

// onBeforeRenderObservable: se ejecuta ANTES de cada frame
scene.onBeforeRenderObservable.add(() => {
	// Actualizar el tiempo transcurrido
	elapsedTime += scene.getEngine().getDeltaTime();
	
	// Limitar los parámetros de la cámara
	if (followCamera) {
		// Mantener el zoom dentro de los límites
		followCamera.radius = BABYLON.Scalar.Clamp(followCamera.radius, 5, 9);
		// Mantener el ángulo vertical dentro de los límites
		followCamera.beta = BABYLON.Scalar.Clamp(
			followCamera.beta,
			BABYLON.Tools.ToRadians(45),
			BABYLON.Tools.ToRadians(80)
		);
	}
	
	// Animación de rotación del servidor (gira sobre sí mismo)
	if (serverMesh && !playerHasPackage) {
		serverMesh.rotate(BABYLON.Axis.Y, 0.01, BABYLON.Space.WORLD);
	}
	
	// Animación de flotación del cartel de entrega (sube y baja con seno)
	if (deliverySign?.metadata?.baseY) {
		deliverySign.position.y = deliverySign.metadata.baseY + Math.sin(elapsedTime * 0.002) * 0.25;
	}

	// Si no hay jugador o cámara, no continuar
	if (!playerMesh || !followCamera) {
		return;
	}

	// IMPORTANTE: Los modelos GLB usan rotationQuaternion por defecto
	// Lo eliminamos para usar rotación euler (rotation.y) que es más simple
	if (playerMesh.rotationQuaternion) {
		playerMesh.rotationQuaternion = null;
	}

	/* ------------------------------------------------------------------------
	   SINCRONIZACIÓN CÁMARA-JUGADOR
	   El jugador siempre mira hacia donde apunta la cámara
	   ------------------------------------------------------------------------ */
	const cameraPosition = followCamera.position;
	const playerPosition = playerMesh.position;
	const directionToCamera = cameraPosition.subtract(playerPosition);
	
	// Calcular el ángulo: el jugador mira OPUESTO a donde está la cámara
	targetPlayerRotationY = Math.atan2(directionToCamera.x, directionToCamera.z);
	
	// Aplicar la rotación al jugador
	playerMesh.rotation.y = targetPlayerRotationY;

	/* ------------------------------------------------------------------------
	   MOVIMIENTO DEL JUGADOR
	   Calcula el vector de movimiento basado en las teclas presionadas
	   y lo rota según la orientación de la cámara
	   ------------------------------------------------------------------------ */
	const moveVector = new BABYLON.Vector3(
		(inputState.right ? 1 : 0) - (inputState.left ? 1 : 0),   // Movimiento lateral
		0,                                                         // Sin movimiento vertical
		(inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0)  // Movimiento frontal
	);

	// Si hay movimiento (alguna tecla presionada)
	if (!moveVector.equals(BABYLON.Vector3.Zero())) {
		// Rotar el vector de movimiento según la orientación del jugador/cámara
		const cosAngle = Math.cos(targetPlayerRotationY);
		const sinAngle = Math.sin(targetPlayerRotationY);
		
		// Transformación de coordenadas locales a mundo
		const rotatedX = -moveVector.x * cosAngle - moveVector.z * sinAngle;
		const rotatedZ = moveVector.x * sinAngle - moveVector.z * cosAngle;
		
		// Normalizar y aplicar velocidad
		const normalized = new BABYLON.Vector3(rotatedX, 0, rotatedZ).normalize().scale(MOVEMENT_SPEED);
		
		// Calcular nueva posición (limitada al área de juego)
		let nextX = BABYLON.Scalar.Clamp(playerMesh.position.x + normalized.x, -GROUND_LIMIT, GROUND_LIMIT);
		let nextZ = BABYLON.Scalar.Clamp(playerMesh.position.z + normalized.z, -GROUND_LIMIT_BACK, GROUND_LIMIT);
		
		// SISTEMA DE COLISIONES CON DESLIZAMIENTO
		// Verifica cada eje por separado para permitir deslizarse contra obstáculos
		const canMoveX = !checkCollisionWithObstacles(nextX, playerMesh.position.z);
		const canMoveZ = !checkCollisionWithObstacles(playerMesh.position.x, nextZ);
		
		if (canMoveX) {
			playerMesh.position.x = nextX;
		}
		if (canMoveZ) {
			playerMesh.position.z = nextZ;
		}

		// ANIMACIÓN Y SONIDO DE CAMINAR
		if (!isWalking && walkAnimationGroup) {
			walkAnimationGroup.start(true);  // Iniciar animación en loop
			isWalking = true;
			// Reproducir sonido de pasos
			if (footstepSound && footstepSound.paused) {
				footstepSound.play().catch(e => console.error("Error pasos:", e));
			}
		}
	} 
	// Si no hay movimiento, detener animación y sonido
	else if (isWalking && walkAnimationGroup) {
		walkAnimationGroup.stop();
		isWalking = false;
		if (footstepSound && !footstepSound.paused) {
			footstepSound.pause();
			footstepSound.currentTime = 0;  // Reiniciar al inicio
		}
	}
	
	// Actualizar la interfaz de usuario cada frame
	updateBabylonGUI();
});

/* ============================================================================
   SECCIÓN 18: INICIO DEL MOTOR DE RENDERIZADO
   ============================================================================ */

// runRenderLoop: El bucle principal que dibuja la escena continuamente
engine.runRenderLoop(() => {
	scene.render();  // Renderizar un frame
});

// Redimensionar el canvas cuando cambia el tamaño de la ventana
window.addEventListener("resize", () => engine.resize());
