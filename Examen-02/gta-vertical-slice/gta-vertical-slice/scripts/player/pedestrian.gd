# pedestrian.gd
# Controls the player character when on foot.
# Attach this script to a CharacterBody2D node.
class_name Pedestrian
extends CharacterBody2D

# Signal emitted when the player chooses to enter a nearby vehicle.
# It passes a reference to the vehicle node.
signal entered_vehicle(vehicle_node: Node2D)

# --- EXPORTED VARIABLES ---
@export_group("Movement")
@export var speed: float = 150.0

# --- NODE REFERENCES ---
# Assign the Area2D node used for vehicle detection in the Inspector.
@export var interaction_area: Area2D

# --- INTERNAL VARIABLES ---
# An array to keep track of vehicles currently within the interaction area.
var _vehicles_in_range: Array[Node2D] = []


func _ready() -> void:
	# RESETEAR TODO AL INICIO
	velocity = Vector2.ZERO
	position = position  # Forzar actualización de posición
	
	print("Pedestrian starting at position: ", global_position)
	print("Pedestrian starting velocity: ", velocity)
	
	# Ensure the interaction_area is assigned.
	if not interaction_area:
		push_error("Interaction Area2D node is not assigned in the Pedestrian script.")
		return

	# Connect the Area2D's signals to our handler functions.
	interaction_area.body_entered.connect(_on_interaction_area_body_entered)
	interaction_area.body_exited.connect(_on_interaction_area_body_exited)


func _unhandled_input(event: InputEvent) -> void:
	# Check if the "interact" action is pressed and there's at least one vehicle nearby.
	if event.is_action_pressed("interact") and not _vehicles_in_range.is_empty():
		# Find the closest vehicle to the player.
		var closest_vehicle = _get_closest_vehicle()
		if closest_vehicle:
			# Emit the signal, passing the vehicle we want to enter.
			# A state machine or main game script will listen for this signal.
			emit_signal("entered_vehicle", closest_vehicle)


func _physics_process(delta: float) -> void:

	# DEBUGGING: Ver si algo está modificando la velocidad
	var velocity_before = velocity
	
	# 1. Obtenemos el input
	var input_direction = Input.get_vector("move_left", "move_right", "move_up", "move_down")
	
	# 2. DEBUG: Imprimimos qué está detectando Godot
	if input_direction != Vector2.ZERO:
		print("Input detectado: ", input_direction)
	elif Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_S):
		print("¡ERROR! Presionas W/S pero el Vector es ZERO. Revisa el Input Map.")

	# 3. Aplicamos movimiento
	velocity = input_direction * speed
	move_and_slide()

	# DEBUGGING: Solo en los primeros frames
	if Engine.get_physics_frames() < 5:
		print("Physics Frame ", Engine.get_physics_frames(), ": Input=", input_direction, " Velocity=", velocity)


# --- SIGNAL HANDLERS ---

# Called when a physics body enters our interaction_area.
func _on_interaction_area_body_entered(body: Node2D) -> void:
	# Check if the body is a vehicle and not already in our list.
	if body.is_in_group("vehicles") and not _vehicles_in_range.has(body):
		_vehicles_in_range.append(body)
		print("Vehicle entered range: ", body.name)


# Called when a physics body exits our interaction_area.
func _on_interaction_area_body_exited(body: Node2D) -> void:
	# If the body is in our list, remove it.
	if _vehicles_in_range.has(body):
		_vehicles_in_range.erase(body)
		print("Vehicle left range: ", body.name)


# --- HELPER METHODS ---

# Finds the closest vehicle from the _vehicles_in_range array.
func _get_closest_vehicle() -> Node2D:
	var closest_vehicle: Node2D = null
	var min_distance_sq = INF # Use squared distance to avoid costly sqrt operations.

	for vehicle in _vehicles_in_range:
		# Ensure the vehicle node is still valid before accessing it.
		if not is_instance_valid(vehicle):
			continue
			
		var distance_sq = global_position.distance_squared_to(vehicle.global_position)
		if distance_sq < min_distance_sq:
			min_distance_sq = distance_sq
			closest_vehicle = vehicle
			
	return closest_vehicle
