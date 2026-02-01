# vehicle.gd
class_name Vehicle
extends RigidBody2D

# --- TUNING (Ajustes) ---
@export_group("Tuning")
@export var acceleration: float = 400.0
@export var max_speed: float = 500.0
@export var friction: float = 2.0
@export var rotation_speed: float = 5.0
@export var handbrake_strength: float = 10.0
@export var tire_grip: float = 0.8

# --- VARIABLES INTERNAS ---
var _input: Vector2 = Vector2.ZERO
var _is_handbrake_active: bool = false
const PIXELS_PER_METER: float = 50.0

# --- AUDIO (Sin @onready para evitar crashes) ---
var sfx_start: AudioStreamPlayer2D
var sfx_engine: AudioStreamPlayer2D

func _ready() -> void:
	linear_damp = friction
	angular_damp = 3.0
	
	# BÚSQUEDA SEGURA DE NODOS
	# Usamos get_node_or_null. Si no existen, las variables quedan vacías (null)
	# y el juego NO se cierra.
	if has_node("SFX_Start"):
		sfx_start = $SFX_Start
	
	if has_node("SFX_Engine"):
		sfx_engine = $SFX_Engine

func _unhandled_input(event: InputEvent) -> void:
	var steer_val = Input.get_axis("move_left", "move_right")
	var accel_val = Input.get_axis("move_down", "move_up")
	_input = Vector2(steer_val, accel_val)
	_is_handbrake_active = Input.is_action_pressed("handbrake")

func _physics_process(delta: float) -> void:
	_apply_drive_force()
	_apply_steering()
	_apply_friction()
	_apply_tire_grip()
	_clamp_speed()
	
	# Actualizar sonido
	_update_engine_sound()

# --- LÓGICA DE AUDIO SEGURA ---
func _update_engine_sound() -> void:
	# CHEQUEO DE SEGURIDAD:
	# Si no existe el nodo de audio O no está sonando, no hacemos nada.
	if not sfx_engine or not sfx_engine.playing:
		return
		
	var current_speed = linear_velocity.length()
	var new_pitch = remap(current_speed, 0, max_speed, 0.8, 2.0)
	sfx_engine.pitch_scale = new_pitch

func start_engine_sound() -> void:
	# Solo reproducimos si los nodos existen
	if sfx_start:
		sfx_start.play()
	if sfx_engine:
		sfx_engine.play()

func stop_engine_sound() -> void:
	if sfx_engine:
		sfx_engine.stop()
	if sfx_start:
		sfx_start.stop()

# --- FÍSICAS ---

func _apply_drive_force() -> void:
	var force = transform.x * _input.y * acceleration
	apply_central_force(force)

func _apply_steering() -> void:
	if _input.x != 0:
		apply_torque(_input.x * rotation_speed * 1000) 
		angular_damp = 1.0
	else:
		angular_damp = 5.0

func _apply_friction() -> void:
	if _input.y == 0:
		linear_damp = friction * 2.0 
	else:
		linear_damp = friction

func _apply_tire_grip() -> void:
	var current_grip = tire_grip
	if _is_handbrake_active:
		current_grip = 0.1 
	
	var steering_vector = transform.y 
	var lateral_velocity = linear_velocity.dot(steering_vector) * steering_vector
	linear_velocity -= lateral_velocity * current_grip

func _clamp_speed() -> void:
	if linear_velocity.length() > max_speed:
		linear_velocity = linear_velocity.limit_length(max_speed)

func get_current_speed() -> float:
	return (linear_velocity.length() / PIXELS_PER_METER) * 3.6
