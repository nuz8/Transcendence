import { applyDecorators } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiParam,
  ApiForbiddenResponse,
  ApiOkResponse,
} from '@nestjs/swagger';
import { FriendshipResponseDto } from "./dto/friendship-response.dto";
import { AcceptedFriendResponseDto } from "./dto/accepted-friend-response.dto";
import { FriendActionResponseDto } from "./dto/friend-action-response.dto";

export function ApiFriendsController() {
  return applyDecorators(
    ApiTags('friends'),
    ApiBearerAuth('access-token'),
  );
}

export function ApiPostFriendRequest() {
  return applyDecorators(
    ApiOperation({ summary: 'Send a friend request' }),
    ApiCreatedResponse({ type: FriendshipResponseDto }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiBadRequestResponse({ description: 'The addressee ID is invalid or is the current user.' }),
    ApiNotFoundResponse({ description: 'The target user was not found.' }),
    ApiConflictResponse({ description: 'A request is already pending or the users are already friends.' }),
  );
}

export function ApiPostAcceptFriendRequest() {
  return applyDecorators(
    ApiOperation({ summary: 'Accept a friend request' }),
    ApiOkResponse({ type: FriendshipResponseDto }),
    ApiParam({ name: 'id', format: 'uuid' }),
    ApiBadRequestResponse({ description: 'Friendship ID is not a valid UUID.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiNotFoundResponse({ description: 'Friendship not found.' }),
    ApiForbiddenResponse({ description: 'Current user cannot respond to this request.' }),
    ApiConflictResponse({ description: 'Friendship is no longer pending.' }),
  );
}

export function ApiPostDeclineFriendRequest() {
  return applyDecorators(
    ApiOperation({ summary: 'Decline a friend request' }),
    ApiOkResponse({ type: FriendshipResponseDto }),
    ApiParam({ name: 'id', format: 'uuid' }),
    ApiBadRequestResponse({ description: 'Friendship ID is not a valid UUID.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiNotFoundResponse({ description: 'Friendship not found.' }),
    ApiForbiddenResponse({ description: 'Current user cannot respond to this request.' }),
    ApiConflictResponse({ description: 'Friendship is no longer pending.' }),
  );
}

export function ApiGetFriends() {
  return applyDecorators(
    ApiOperation({ summary: 'List the current user’s friends' }),
    ApiOkResponse({ type: [AcceptedFriendResponseDto] }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
  );
}

export function ApiGetPendingFriendRequests() {
  return applyDecorators(
    ApiOperation({ summary: 'List incoming friend requests' }),
    ApiOkResponse({ type: [FriendshipResponseDto] }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
  );
}

export function ApiGetOutgoingFriendRequests() {
  return applyDecorators(
    ApiOperation({ summary: 'List outgoing friend requests' }),
    ApiOkResponse({ type: [FriendshipResponseDto] }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
  );
}

export function ApiDeleteFriend() {
  return applyDecorators(
    ApiOperation({ summary: 'Remove a friend' }),
    ApiOkResponse({ type: FriendActionResponseDto }),
    ApiParam({ name: 'id', format: 'uuid' }),
    ApiBadRequestResponse({ description: 'Friendship ID is not a valid UUID.' }),
    ApiUnauthorizedResponse({ description: 'Missing or invalid access token.' }),
    ApiForbiddenResponse({ description: 'Current user cannot remove this friendship.' }),
    ApiNotFoundResponse({ description: 'Friendship not found.' }),
  );
}