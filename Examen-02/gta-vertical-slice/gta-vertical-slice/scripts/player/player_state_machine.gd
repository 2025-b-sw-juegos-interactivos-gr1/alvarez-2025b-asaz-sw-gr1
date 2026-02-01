# player_state_machine.gd
# Manages the player's state (ON_FOOT or DRIVING) and transitions between them.
class_name PlayerStateMachine
extends Node

# Enum for player states.
enum State { ON_FOOT, DRIVING }

# Signal emitted when the state changes.
signal state_changed(new_state: State, target_node: Node2D)

# The current state of the player.
var current_state: State = State.ON_FOOT

# --- NODE REFERENCES ---
@export var pedestrian: Pedestrian
@export var initial_vehicle: Vehicle
@export var initial_state: State = State.ON_FOOT

# Stores a reference to the vehicle the player is currently driving.
var current_vehicle: Vehicle

func _ready() -> void:
	if not pedestrian:
		push_error("PlayerStateMachine: Pedestrian node not assigned!")
		return

	# Connect signals
	pedestrian.entered_vehicle.connect(_on_pedestrian_entered_vehicle)

	# Setup initial state
	if initial_state == State.DRIVING:
		if not initial_vehicle:
			push_error("Initial state is DRIVING, but no Initial Vehicle was assigned.")
			initial_state = State.ON_FOOT
		else:
			current_vehicle = initial_vehicle

	change_state(initial_state)


# --- SIGNAL HANDLERS ---

func _on_pedestrian_entered_vehicle(vehicle_node: Node2D) -> void:
	# 1. Intentamos forzar el reconocimiento del tipo
	var vehicle = vehicle_node as Vehicle
	
	# 2. PLAN B: Si Godot dice que es null (bug de caché), verificamos manualmente
	if not vehicle:
		if vehicle_node.has_method("get_current_speed"):
			vehicle = vehicle_node 
		else:
			push_warning("Objeto detectado NO es válido: " + vehicle_node.name)
			return

	current_vehicle = vehicle
	
	# Encender sonido del motor
	if current_vehicle.has_method("start_engine_sound"):
		current_vehicle.start_engine_sound()
		
	change_state(State.DRIVING)


# --- INPUT HANDLING (EXIT LOGIC) ---

func _unhandled_input(event: InputEvent) -> void:
	if current_state == State.DRIVING:
		if event.is_action_pressed("exit_vehicle"):
			# Llamamos a la nueva lógica segura de salida
			_exit_vehicle_logic()

# NUEVA LÓGICA SEGURA PARA SALIR DEL VEHÍCULO
func _exit_vehicle_logic() -> void:
	if not is_instance_valid(current_vehicle):
		change_state(State.ON_FOOT)
		return

	# 1. Detenemos el sonido del motor
	if current_vehicle.has_method("stop_engine_sound"):
		current_vehicle.stop_engine_sound()
	
	# 2. CÁLCULO DE POSICIÓN SEGURA
	# Usamos 90 píxeles de distancia para evitar chocar con la colisión del auto
	var exit_offset = Vector2(90, 0).rotated(current_vehicle.rotation)
	var exit_pos = current_vehicle.global_position + exit_offset
	
	# 3. Asignamos la posición al peatón usando coordenadas globales
	pedestrian.global_position = exit_pos
	
	# 4. Reseteamos físicas para evitar que salga "patinando"
	pedestrian.rotation = 0
	pedestrian.velocity = Vector2.ZERO
	
	# 5. Finalmente cambiamos de estado
	change_state(State.ON_FOOT)


# --- STATE MANAGEMENT ---

func change_state(new_state: State) -> void:
	if new_state == current_state and get_tree().current_scene != null:
		return

	# Salir del estado actual
	match current_state:
		State.DRIVING:
			_exit_driving_state()

	current_state = new_state

	var target_node: Node2D = null
	
	# Entrar al nuevo estado
	match current_state:
		State.ON_FOOT:
			_enter_on_foot_state()
			target_node = pedestrian
		State.DRIVING:
			_enter_driving_state()
			target_node = current_vehicle

	# Notificar a la cámara
	if is_instance_valid(target_node):
		emit_signal("state_changed", current_state, target_node)
		# print("Player state changed to: ", State.keys()[current_state])


# --- STATE ENTRY/EXIT LOGIC ---

func _enter_on_foot_state() -> void:
	if not is_instance_valid(pedestrian): return
	
	# Nota: La posición ya se calculó en _exit_vehicle_logic, 
	# así que aquí solo activamos visuales y cámara.
	
	pedestrian.velocity = Vector2.ZERO
	pedestrian.show()
	
	_move_camera_to(pedestrian)


func _exit_driving_state() -> void:
	if not is_instance_valid(current_vehicle): return

	# Congelar el vehículo cuando salimos (Optimization)
	current_vehicle.freeze = true
	current_vehicle.set_physics_process(false)
	current_vehicle.set_process_unhandled_input(false)
	
	# Soltamos la referencia
	current_vehicle = null


func _enter_driving_state() -> void:
	if not is_instance_valid(pedestrian) or not is_instance_valid(current_vehicle):
		push_error("State machine cannot enter DRIVING state. Invalid nodes.")
		change_state(State.ON_FOOT)
		return
	
	# Descongelar el vehículo
	current_vehicle.freeze = false
	current_vehicle.set_physics_process(true)
	current_vehicle.set_process_unhandled_input(true)
	
	# Visuales
	current_vehicle.show()
	pedestrian.hide()
	
	_move_camera_to(current_vehicle)


func _physics_process(delta: float) -> void:
	pass


# --- CAMERA LOGIC ---

func _move_camera_to(target: Node2D) -> void:
	# Buscamos la cámara en el grupo "camera"
	var camera = get_tree().get_first_node_in_group("camera")
	
	if not camera:
		# Fallback: buscarla en la raíz si no usaste grupos
		if get_tree().root.has_node("MainGame/Camera2D"):
			camera = get_tree().root.get_node("MainGame/Camera2D")
	
	if camera and camera.has_method("_on_player_state_machine_state_changed"):
		# Simplemente actualizamos el target, NO cambiamos el padre
		camera.target = target
