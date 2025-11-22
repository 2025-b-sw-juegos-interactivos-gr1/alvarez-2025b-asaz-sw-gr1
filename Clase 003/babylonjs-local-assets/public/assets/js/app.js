window.addEventListener('DOMContentLoaded', function () {
    var canvas = document.getElementById('renderCanvas');
    var engine = new BABYLON.Engine(canvas, true);

    var createScene = function () {
        var scene = new BABYLON.Scene(engine);
        
        // Color de fondo oscuro y tenebroso
        scene.clearColor = new BABYLON.Color3(0.05, 0.05, 0.1);

        // Cámara posicionada para vista aérea del bosque
        var camera = new BABYLON.ArcRotateCamera("camera1", -Math.PI / 2, Math.PI / 3, 30, new BABYLON.Vector3(0, 5, 0), scene);
        camera.attachControl(canvas, true);
        camera.lowerRadiusLimit = 15;
        camera.upperRadiusLimit = 50;

        // ========== ILUMINACIÓN DE TERROR ==========
        // Luz ambiental muy tenue con tono azulado (luna)
        var ambientLight = new BABYLON.HemisphericLight("ambientLight", new BABYLON.Vector3(0, 1, 0), scene);
        ambientLight.intensity = 0.3;
        ambientLight.diffuse = new BABYLON.Color3(0.4, 0.5, 0.8);
        ambientLight.groundColor = new BABYLON.Color3(0.1, 0.1, 0.2);

        // Luz direccional tenue (simula luz de luna)
        var moonLight = new BABYLON.DirectionalLight("moonLight", new BABYLON.Vector3(-1, -2, -1), scene);
        moonLight.intensity = 0.4;
        moonLight.diffuse = new BABYLON.Color3(0.6, 0.7, 1.0);
        moonLight.specular = new BABYLON.Color3(0.3, 0.4, 0.6);

        // Luz puntual sutil que sigue al ave (efecto siniestro)
        var birdLight = new BABYLON.PointLight("birdLight", new BABYLON.Vector3(0, 10, 0), scene);
        birdLight.intensity = 0.5;
        birdLight.diffuse = new BABYLON.Color3(0.8, 0.3, 0.3); // Tono rojizo
        birdLight.range = 20;

        // ========== NIEBLA ATMOSFÉRICA ==========
        scene.fogMode = BABYLON.Scene.FOGMODE_EXP2;
        scene.fogDensity = 0.02;
        scene.fogColor = new BABYLON.Color3(0.1, 0.1, 0.15);

        // Variable para almacenar el ave
        var terrorbirdMesh = null;
        var birdMovementAngle = 0;
        var birdRadius = 8; // Radio del área de movimiento
        var birdHeight = 3; // Altura de vuelo (sobre el bosque)
        var birdSpeed = 0.5; // Velocidad de movimiento

        // ========== CARGAR BOSQUE (pine_forest) ==========
        BABYLON.SceneLoader.ImportMeshAsync(null, "./assets/models/", "pine_forest.glb", scene).then((result) => {
            const meshes = result.meshes;
            if (meshes && meshes.length) {
                meshes[0].scaling = new BABYLON.Vector3(2, 2, 2);
                meshes[0].position = new BABYLON.Vector3(0, 0, 0);
                console.log('Bosque cargado correctamente desde assets/models/pine_forest.glb');
            }
        }).catch((err) => {
            console.error('Error al cargar el bosque:', err);
        });

        // ========== CARGAR AVE DE TERROR (terror_bird) ==========
        BABYLON.SceneLoader.ImportMeshAsync(null, "./assets/models/", "terror_bird_nhmw_-_optimized_obj.glb", scene).then((result) => {
            const meshes = result.meshes;
            if (meshes && meshes.length) {
                terrorbirdMesh = meshes[0];
                
                // Escalar el ave mucho más pequeña
                terrorbirdMesh.scaling = new BABYLON.Vector3(0.002, 0.002, 0.002);
                terrorbirdMesh.position = new BABYLON.Vector3(birdRadius, birdHeight, 0);
                
                // Rotar el ave para que mire en la dirección del movimiento
                terrorbirdMesh.rotation.y = Math.PI / 2;
                
                console.log('Ave de terror cargada correctamente desde assets/models/terror_bird_nhmw_-_optimized_obj.glb');
                console.log('Número de meshes cargados:', meshes.length);
                console.log('Animación activada - el ave debería moverse en círculos');
            }
        }).catch((err) => {
            console.error('Error al cargar el ave de terror:', err);
        });

        // ========== ANIMACIÓN DEL AVE ==========
        var animationStarted = false;
        scene.registerBeforeRender(function() {
            if (terrorbirdMesh) {
                if (!animationStarted) {
                    console.log('🦅 Iniciando animación del ave...');
                    animationStarted = true;
                }
                
                // Movimiento circular del ave
                birdMovementAngle += 0.01 * birdSpeed;
                
                var x = Math.cos(birdMovementAngle) * birdRadius;
                var z = Math.sin(birdMovementAngle) * birdRadius;
                
                // Actualizar posición
                terrorbirdMesh.position.x = x;
                terrorbirdMesh.position.z = z;
                terrorbirdMesh.position.y = birdHeight + Math.sin(birdMovementAngle * 3) * 0.5; // Oscilación vertical sutil
                
                // Rotar el ave para que mire hacia donde se mueve
                terrorbirdMesh.rotation.y = -birdMovementAngle + Math.PI / 2;
                
                // Actualizar posición de la luz que sigue al ave
                birdLight.position.x = x;
                birdLight.position.y = birdHeight + 2;
                birdLight.position.z = z;
            }
        });

        return scene;
    };

    var scene = createScene();
    engine.runRenderLoop(function () {
        scene.render();
    });

    window.addEventListener('resize', function () {
        engine.resize();
    });
});
